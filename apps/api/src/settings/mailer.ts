import { connect as tlsConnect } from "node:tls";
import { createConnection } from "node:net";

export interface SmtpConfig {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  from?: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(message: MailMessage, smtp: SmtpConfig): Promise<void>;
}

class SmtpSession {
  private buffer = "";

  constructor(private socket: NodeJS.ReadWriteStream) {}

  async expect(ok: (code: number) => boolean): Promise<string> {
    while (true) {
      const newline = this.buffer.indexOf("\n");
      if (newline !== -1) {
        const line = this.buffer.slice(0, newline).replace(/\r$/, "");
        this.buffer = this.buffer.slice(newline + 1);
        const code = Number.parseInt(line.slice(0, 3), 10);
        if (line.length >= 4 && line[3] === "-") {
          continue;
        }
        if (!Number.isFinite(code) || !ok(code)) {
          throw new Error(`SMTP ${line}`);
        }
        return line;
      }
      const chunk = await new Promise<string>((resolve, reject) => {
        const onData = (data: Buffer | string) => {
          cleanup();
          resolve(typeof data === "string" ? data : data.toString("utf8"));
        };
        const onError = (error: Error) => {
          cleanup();
          reject(error);
        };
        const cleanup = () => {
          this.socket.off("data", onData);
          this.socket.off("error", onError);
        };
        this.socket.once("data", onData);
        this.socket.once("error", onError);
      });
      this.buffer += chunk;
    }
  }

  write(command: string): void {
    this.socket.write(`${command}\r\n`);
  }

  async command(command: string, ok: (code: number) => boolean): Promise<string> {
    this.write(command);
    return this.expect(ok);
  }
}

function connectPlain(host: string, port: number): Promise<import("node:net").Socket> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port });
    socket.setEncoding("utf8");
    socket.once("connect", () => resolve(socket));
    socket.once("error", reject);
  });
}

function connectTls(host: string, port: number): Promise<import("node:tls").TLSSocket> {
  return new Promise((resolve, reject) => {
    const socket = tlsConnect({ host, port, servername: host });
    socket.setEncoding("utf8");
    socket.once("secureConnect", () => resolve(socket));
    socket.once("error", reject);
  });
}

function upgradeTls(
  socket: import("node:net").Socket,
  host: string,
): Promise<import("node:tls").TLSSocket> {
  return new Promise((resolve, reject) => {
    const tlsSocket = tlsConnect({ socket, servername: host }, () => resolve(tlsSocket));
    tlsSocket.setEncoding("utf8");
    tlsSocket.once("error", reject);
  });
}

function encodeAddress(value: string): string {
  const match = /<([^>]+)>/.exec(value);
  return match?.[1] ?? value;
}

function okReady(code: number): boolean {
  return code === 220;
}

function okInfo(code: number): boolean {
  return code === 250 || code === 251;
}

function okAuth(code: number): boolean {
  return code === 235 || code === 334;
}

function okData(code: number): boolean {
  return code === 354;
}

export function createSmtpMailer(): Mailer {
  return {
    async send(message, smtp) {
      const implicitTls = smtp.port === 465;
      let raw: NodeJS.ReadWriteStream = implicitTls
        ? await connectTls(smtp.host, smtp.port)
        : await connectPlain(smtp.host, smtp.port);
      let session = new SmtpSession(raw);
      await session.expect(okReady);
      const greeting = await session.command(`EHLO fluxo`, okInfo);
      if (!implicitTls && greeting.toLowerCase().includes("starttls")) {
        await session.command("STARTTLS", okReady);
        raw = await upgradeTls(raw as import("node:net").Socket, smtp.host);
        session = new SmtpSession(raw);
        await session.command(`EHLO fluxo`, okInfo);
      }
      if (smtp.user && smtp.pass) {
        await session.command("AUTH LOGIN", okAuth);
        await session.command(Buffer.from(smtp.user).toString("base64"), okAuth);
        await session.command(Buffer.from(smtp.pass).toString("base64"), (code) => code === 235);
      }
      const from = encodeAddress(smtp.from ?? message.to);
      await session.command(`MAIL FROM:<${from}>`, okInfo);
      await session.command(`RCPT TO:<${encodeAddress(message.to)}>`, okInfo);
      await session.command("DATA", okData);
      const payload = [
        `From: ${smtp.from ?? from}`,
        `To: ${message.to}`,
        `Subject: ${message.subject}`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=utf-8",
        "",
        message.text.replace(/^\./gm, ".."),
        ".",
      ].join("\r\n");
      raw.write(`${payload}\r\n`);
      await session.expect(okInfo);
      await session.command("QUIT", (code) => code === 221 || code === 250);
    },
  };
}

export function createRecordingMailer(sent: Array<{ message: MailMessage; smtp: SmtpConfig }>): Mailer {
  return {
    async send(message, smtp) {
      sent.push({ message, smtp: { ...smtp } });
    },
  };
}

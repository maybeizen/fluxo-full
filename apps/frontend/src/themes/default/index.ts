import { defaultComponents } from "./components";
import type { ThemeModule } from "@/theme-system/types";
import manifest from "./theme.json";
import translations from "./translations/en.json";
import "./styles/tokens.css";

const theme = {
  manifest,
  components: defaultComponents,
  translations,
} satisfies ThemeModule;

export default theme;

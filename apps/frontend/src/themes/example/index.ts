import type { ThemeModule } from "@/theme-system/types";
import { MarketingNavbar } from "./components/layout/MarketingNavbar";
import manifest from "./theme.json";
import translations from "./translations/en.json";

const theme = {
  manifest,
  components: {
    MarketingNavbar,
  },
  translations,
} satisfies ThemeModule;

export default theme;

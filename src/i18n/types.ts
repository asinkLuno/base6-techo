// 以 zh-CN 词条为基准，让 t() 的 key 与返回值获得完整类型检查。
import type zhCN from "./locales/zh-CN.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: {
      translation: typeof zhCN;
    };
  }
}

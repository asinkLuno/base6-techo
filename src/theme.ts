import { createTheme } from "@mui/material/styles";

// base6 techo · 纸面工作台
// 与 showcase 版式样张集同一身份：装订案上的一张纸，
// 墨色书写、朱砂缝线、发丝线分栏。
//  --desk 案面 · --paper 纸面 · --ink 墨 · --ink2 淡墨 · --zhu 朱砂缝线 · --line 发丝线
const ink = "#26231e";
const ink2 = "#6e6960";
const zhu = "#9e3b2b";
const desk = "#eae6dc";
const paper = "#fbfaf6";
const line = "rgba(38, 35, 30, 0.16)";
const lineStrong = "rgba(38, 35, 30, 0.22)";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: ink },
    secondary: { main: zhu },
    divider: line,
    background: { default: desk, paper },
    text: { primary: ink, secondary: ink2 },
  },
  shape: { borderRadius: 3 },
  typography: {
    fontFamily: [
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      '"Noto Sans SC"',
      '"PingFang SC"',
      '"Microsoft YaHei"',
      "sans-serif",
    ].join(","),
    h6: {
      fontWeight: 600,
      letterSpacing: "0.02em",
    },
    caption: {
      letterSpacing: "0.04em",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          // 发丝线分栏下，页面本身就是案上的一张纸
          backgroundImage: `linear-gradient(to right, transparent calc(100% - 1px), ${lineStrong} 1px)`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "calc(50% + 12px) 0",
          backgroundSize: "calc(100% - 24px) 100%",
          backgroundAttachment: "fixed",
        },
      },
    },
    MuiTextField: { defaultProps: { size: "small", fullWidth: true } },
    MuiSelect: { defaultProps: { size: "small", fullWidth: true } },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          borderColor: line,
          bgcolor: paper,
        },
      },
    },
    MuiCardHeader: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
  },
});

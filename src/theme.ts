import { createTheme } from "@mui/material/styles";

// base6 techo · 纸面工作台
// ink: 墨色 slate, thread: 缝线赤陶, paper: 暖纸底
export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#3d4754" },
    secondary: { main: "#c05a3a" },
    divider: "rgba(45, 54, 64, 0.12)",
    background: { default: "#f4f2ec", paper: "#ffffff" },
    text: { primary: "#2c323b", secondary: "#737b86" },
  },
  shape: { borderRadius: 6 },
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
  },
  components: {
    MuiTextField: { defaultProps: { size: "small", fullWidth: true } },
    MuiSelect: { defaultProps: { size: "small", fullWidth: true } },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          borderColor: "rgba(45, 54, 64, 0.16)",
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

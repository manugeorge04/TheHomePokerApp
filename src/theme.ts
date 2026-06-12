import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#4ade80',
      dark: '#16a34a',
      light: '#86efac',
      contrastText: '#0a0f0a',
    },
    secondary: {
      main: '#fbbf24',
      dark: '#d97706',
      light: '#fde68a',
      contrastText: '#0a0f0a',
    },
    background: {
      default: '#080d08',
      paper: '#0f1a0f',
    },
    success: {
      main: '#4ade80',
      dark: '#16a34a',
      light: '#86efac',
    },
    error: {
      main: '#f87171',
      dark: '#dc2626',
      light: '#fca5a5',
    },
    warning: {
      main: '#fbbf24',
    },
    text: {
      primary: '#f0fdf4',
      secondary: '#86efac',
      disabled: 'rgba(134,239,172,0.38)',
    },
    divider: 'rgba(74,222,128,0.12)',
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage:
            'radial-gradient(ellipse at top, #0d2010 0%, #080d08 60%)',
          minHeight: '100vh',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#111a11',
          border: '1px solid rgba(74,222,128,0.1)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #4ade80, #16a34a)',
          color: '#080d08',
          '&:hover': {
            background: 'linear-gradient(135deg, #86efac, #4ade80)',
          },
        },
        containedSecondary: {
          background: 'linear-gradient(135deg, #fbbf24, #d97706)',
          color: '#080d08',
          '&:hover': {
            background: 'linear-gradient(135deg, #fde68a, #fbbf24)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          backgroundColor: '#0a120a',
          borderTop: '1px solid rgba(74,222,128,0.12)',
          height: 64,
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          color: 'rgba(134,239,172,0.5)',
          '&.Mui-selected': {
            color: '#4ade80',
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(74,222,128,0.2)',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(74,222,128,0.4)',
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(74,222,128,0.1)',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(74,222,128,0.1)',
          borderRadius: 4,
        },
        bar: {
          borderRadius: 4,
        },
      },
    },
  },
});

export default theme;

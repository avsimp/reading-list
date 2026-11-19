import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    primary: { main: '#2c503e' }, background: { default: '#f7f4ec', paper: '#efefe5' },
    text: { primary: '#203b31', secondary: '#536155' },
  },
  shape: { borderRadius: 5 },
  spacing: 8,
  typography: {
    fontFamily: 'Arial, sans-serif',
    button: { textTransform: 'none', fontWeight: 700, fontSize: '1rem' },
    h1: { fontFamily: 'Georgia, serif', fontWeight: 400 },
    h2: { fontFamily: 'Georgia, serif', fontWeight: 400 },
  },
})

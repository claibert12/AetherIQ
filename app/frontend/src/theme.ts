import { extendTheme } from '@chakra-ui/react';

export const theme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false,
  },
  styles: {
    global: {
      body: {
        bg: '#0a0a0a',
        color: 'white',
      },
    },
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: 'normal',
        borderRadius: '6px',
      },
    },
    Input: {
      baseStyle: {
        field: {
          _focus: {
            borderColor: '#00d4ff',
            boxShadow: 'none',
          },
        },
      },
    },
  },
  colors: {
    brand: {
      50: '#e6f6ff',
      100: '#b3e0ff',
      200: '#80cbff',
      300: '#4db5ff',
      400: '#1a9fff',
      500: '#00d4ff',
      600: '#0094ff',
      700: '#0073cc',
      800: '#005299',
      900: '#003166',
    },
  },
  fonts: {
    heading: 'Inter, -apple-system, system-ui, sans-serif',
    body: 'Inter, -apple-system, system-ui, sans-serif',
  },
}); 
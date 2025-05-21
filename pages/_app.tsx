import type { AppProps } from 'next/app'
import { ThemeProvider } from 'next-themes'
import { AuthProvider } from '@/components/AuthContext'
import '@/styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
	return (
		<AuthProvider>
			<ThemeProvider
				attribute='class'
				defaultTheme='system'
				disableTransitionOnChange
			>
				<Component {...pageProps} />
			</ThemeProvider>
		</AuthProvider>
	)
}

import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuth } from '@/components/AuthContext'

const BottomNav = () => {
	const router = useRouter()
	const { isAdmin } = useAuth()

	const allLinks = isAdmin ? [...links, adminLink] : links

	return (
		<div className='sm:hidden'>
			<nav className='fixed bottom-0 w-full border-t bg-zinc-100 pb-safe dark:border-zinc-800 dark:bg-zinc-900'>
				<div className='mx-auto flex h-16 max-w-md items-center justify-around px-6'>
					{allLinks.map(({ href, label, icon }) => (
						<Link
							key={label}
							href={href}
							className={`flex h-full w-full flex-col items-center justify-center space-y-1 ${
								router.pathname === href
									? 'text-indigo-500 dark:text-indigo-400'
									: 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
							}`}
						>
							{icon}
							<span className='text-xs text-zinc-600 dark:text-zinc-400'>
								{label}
							</span>
						</Link>
					))}
				</div>
			</nav>
		</div>
	)
}

export default BottomNav

const links = [
	{
		label: 'Home',
		href: '/',
		icon: (
			<svg
				viewBox='0 0 15 15'
				fill='none'
				xmlns='http://www.w3.org/2000/svg'
				width='18'
				height='18'
			>
				<path
					d='M7.5.5l.325-.38a.5.5 0 00-.65 0L7.5.5zm-7 6l-.325-.38L0 6.27v.23h.5zm5 8v.5a.5.5 0 00.5-.5h-.5zm4 0H9a.5.5 0 00.5.5v-.5zm5-8h.5v-.23l-.175-.15-.325.38zM1.5 15h4v-1h-4v1zm13.325-8.88l-7-6-.65.76 7 6 .65-.76zm-7.65-6l-7 6 .65.76 7-6-.65-.76zM6 14.5v-3H5v3h1zm3-3v3h1v-3H9zm.5 3.5h4v-1h-4v1zm5.5-1.5v-7h-1v7h1zm-15-7v7h1v-7H0zM7.5 10A1.5 1.5 0 019 11.5h1A2.5 2.5 0 007.5 9v1zm0-1A2.5 2.5 0 005 11.5h1A1.5 1.5 0 017.5 10V9zm6 6a1.5 1.5 0 001.5-1.5h-1a.5.5 0 01-.5.5v1zm-12-1a.5.5 0 01-.5-.5H0A1.5 1.5 0 001.5 15v-1z'
					fill='currentColor'
				/>
			</svg>
		),
	},
	{
		label: 'Projects',
		href: '/projects',
		icon: (
			<svg
				viewBox='0 0 15 15'
				fill='none'
				xmlns='http://www.w3.org/2000/svg'
				width='18'
				height='18'
			>
				<path
					d='M1.5 1h12V0h-12v1zm0 3h12V3h-12v1zm6 3h6V6h-6v1zm6 3h-6v1h6v-1zm-6 3h6v-1h-6v1zm-1-6h-5v5h5V7zm-1 4h-3V8h3v3z'
					fill='currentColor'
				/>
			</svg>
		),
	},
]

const adminLink = {
	label: 'Admin',
	href: '/admin/templates',
	icon: (
		<svg
			viewBox='0 0 15 15'
			fill='none'
			xmlns='http://www.w3.org/2000/svg'
			width='18'
			height='18'
		>
			<path
				d='M5.5 3A2.5 2.5 0 003 5.5v.5H2v1h1v4.5A2.5 2.5 0 005.5 14h4a2.5 2.5 0 002.5-2.5V7h1V6h-1v-.5A2.5 2.5 0 009.5 3h-4zM4 5.5A1.5 1.5 0 015.5 4h4A1.5 1.5 0 0111 5.5V6H4v-.5zM4 7h7v4.5A1.5 1.5 0 019.5 13h-4A1.5 1.5 0 014 11.5V7z'
				fill='currentColor'
			/>
		</svg>
	),
}

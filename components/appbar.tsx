import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/utils/supabaseClient';

const links = [
	{ label: 'Projects', href: '/projects' },
]

const Appbar = () => {
	const { user } = useAuth();
	const router = useRouter();

	const handleLogout = async () => {
		await supabase.auth.signOut();
		router.replace('/login');
	};

	return (
		<div className='fixed top-0 left-0 z-20 w-full bg-zinc-900 pt-safe'>
			<header className='border-b bg-zinc-100 px-safe dark:border-zinc-800 dark:bg-zinc-900'>
				<div className='mx-auto flex h-20 max-w-screen-md lg:max-w-screen-lg items-center justify-between px-6'>
					<Link href='/'>
						<h1 className='font-medium'>Rice Bowl</h1>
					</Link>

					<nav className='flex items-center space-x-6'>
						<div className='hidden sm:block'>
							<div className='flex items-center space-x-6'>
								{links.map(({ label, href }) => (
									<Link
										key={label}
										href={href}
										className={`text-sm ${
											router.pathname === href
												? 'text-indigo-500 dark:text-indigo-400'
												: 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
										}`}
									>
										{label}
									</Link>
								))}
							</div>
						</div>

						<div
							title='Gluten Free'
							className='h-10 w-10 rounded-full bg-zinc-200 bg-cover bg-center shadow-inner dark:bg-zinc-800'
							style={{
								backgroundImage:
									'url(https://images.unsplash.com/photo-1612480797665-c96d261eae09?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80)',
							}}
							/>
							{user && (
								<button
									onClick={handleLogout}
									className='text-sm px-3 py-1 rounded bg-zinc-800 text-white hover:bg-zinc-700'
								>
									Logout
								</button>
							)}
					</nav>
				</div>
			</header>
		</div>
	)
}

export default Appbar

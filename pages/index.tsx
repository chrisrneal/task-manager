import Page from '@/components/page'
import Section from '@/components/section'
import { useAuth } from '@/components/AuthContext';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const Index = () => {
	const { user, loading } = useAuth();
	const router = useRouter();

	useEffect(() => {
		if (!loading && !user) {
			router.replace('/login');
		}
	}, [user, loading, router]);

	if (loading) return <div className='flex items-center justify-center min-h-screen'>Loading...</div>;
	if (!user) return null;

	return (
		<Page>
			<Section>
				<h2 className='text-xl font-semibold text-zinc-800 dark:text-zinc-200'>
					We grow a lot of rice.
				</h2>

				<div className='mt-2'>
					<p className='text-zinc-600 dark:text-zinc-400'>
						You love rice, and so does the rest of the world. In the crop year
						2008/2009, the milled rice production volume amounted to over{' '}
						<span className='font-medium text-zinc-900 dark:text-zinc-50'>
							448 million tons
						</span>{' '}
						worldwide.
					</p>

					<br />

					<p className='text-sm text-zinc-600 dark:text-zinc-400'>
						<a
							href='https://github.com/mvllow/next-pwa-template'
							className='underline'
						>
							Source
						</a>
					</p>
				</div>
			</Section>
		</Page>
	);
}

export default Index

import Page from '@/components/page'
import Section from '@/components/section'
import { useAuth } from '@/components/AuthContext';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const Projects = () => {
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
				<h2 className='text-xl font-semibold'>Projects</h2>

				<div className='mt-2'>
					<p className='text-zinc-600 dark:text-zinc-400'>
						Your projects will appear here.
					</p>
				</div>
			</Section>
		</Page>
	);
}

export default Projects
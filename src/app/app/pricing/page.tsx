import { redirect } from 'next/navigation';

/**
 * Redirect to public pricing page
 */
export default function AppPricingPage() {
  redirect('/pricing');
}

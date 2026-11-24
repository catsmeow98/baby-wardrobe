import { redirect } from 'next/navigation';

// The middleware sends signed-out visitors to /login. Signed-in visitors land on their children.
export default function Home() {
  redirect('/dashboard');
}

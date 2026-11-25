import { redirect } from 'next/navigation';

/** Brands are managed on the Forecast page now. Old links and bookmarks land there. */
export default function BrandsRedirect() {
  return redirect('/forecast#brands');
}

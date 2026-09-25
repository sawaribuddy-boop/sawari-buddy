import { Redirect } from 'expo-router';

// Entry route. Step 3 replaces this with: no session -> welcome, PASSENGER -> passenger home, DRIVER -> driver home.
export default function Index() {
  return <Redirect href="/welcome" />;
}

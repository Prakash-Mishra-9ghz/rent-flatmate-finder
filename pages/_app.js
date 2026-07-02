import "../styles/globals.css";
import Navbar from "../components/Navbar";
import { UserProvider } from "../lib/useUser";

export default function App({ Component, pageProps }) {
  return (
    <UserProvider>
      <Navbar />
      <Component {...pageProps} />
    </UserProvider>
  );
}

import { redirect } from "next/navigation";

export default function HomePage() {
  // Later:
  // const session = await getSession();

  const isLoggedIn = false;

  if (isLoggedIn) {
    redirect("/chat");
  }

  redirect("/login");
}
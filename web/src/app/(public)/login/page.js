import { signInDemo } from "@/app/actions/auth-actions";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";

export const metadata = {
  title: "Sign In",
};

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const next = params?.next || "/dashboard";

  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <Card className="w-full max-w-lg p-8">
        <h1 className="text-4xl font-black">Choose a demo role</h1>
        <p className="mt-4 text-muted">
          This front-end build uses secure HTTP-only role cookies for route
          demonstration. Production auth plugs into the backend OTP/JWT flow.
        </p>
        <form action={signInDemo} className="mt-7 grid gap-4">
          <input type="hidden" name="next" value={next} />
          <label className="grid gap-2 text-sm font-bold text-muted">
            Role
            <select name="role" className="rounded-lg border border-line bg-background p-3 text-foreground">
              <option value="customer">Customer</option>
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </label>
          <Button type="submit" className="w-full">Continue</Button>
        </form>
      </Card>
    </main>
  );
}

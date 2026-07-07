import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Scale } from "lucide-react";

const formSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export function LoginPage() {
  const [, setLocation] = useLocation();
  const { login: setAuthToken } = useAuth();
  const [errorMsg, setErrorMsg] = useState("");

  const loginMutation = useLogin();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: (zodResolver as any)(formSchema) as unknown as Resolver<z.infer<typeof formSchema>>,
    defaultValues: {
      email: "",
      password: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    setErrorMsg("");
    loginMutation.mutate({ data: values }, {
      onSuccess: (data) => {
        setAuthToken(data.token);
        if (data.user.role === "AGENT_VIEWER") {
          setLocation("/agent-portal");
        } else {
          setLocation("/dashboard");
        }
      },
      onError: (error) => {
        setErrorMsg(error.message || "Invalid credentials");
      }
    });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container-max grid grid-cols-1 md:grid-cols-2 min-h-screen items-center">
        {/* Hero column */}
        <div className="hidden md:flex items-center justify-center px-6">
          <div className="max-w-lg">
            <div className="mb-6">
              <h1 className="text-hero font-extrabold">Premium, modern collections</h1>
              <p className="mt-4 text-body-lg text-muted-foreground">Lean, secure, and crafted for legal teams — manage levies, matters and collections with clarity.</p>
            </div>
            <div className="flex gap-4">
              <Button onClick={() => setLocation("/contact")} className="btn-ghost-interaction px-5 py-3 bg-primary text-primary-foreground shadow-sm">Get Started</Button>
              <Button variant="ghost" onClick={() => setLocation("/contact")} className="btn-ghost-interaction px-5 py-3">Learn More</Button>
            </div>
          </div>
        </div>

        {/* Login column */}
        <div className="flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="flex flex-col items-center justify-center text-center mb-6 md:hidden">
              <div className="h-16 w-16 bg-primary rounded-xl flex items-center justify-center mb-4 shadow-lg">
                <Scale className="h-8 w-8 text-primary-foreground" />
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight">Levy<span className="text-primary">Connect</span></h2>
              <p className="mt-2 text-sm text-muted-foreground font-medium uppercase tracking-wider">Practice Management Platform</p>
            </div>

            <Card className="border-0 shadow-xl shadow-black/5 dark:shadow-black/20">
              <CardHeader className="space-y-1 pb-6">
                <CardTitle className="text-xl font-bold text-center">Sign in to your account</CardTitle>
                <CardDescription className="text-center">
                  Enter your email and password to access the platform
                </CardDescription>
              </CardHeader>
              <CardContent>
                {errorMsg && (
                  <Alert variant="destructive" className="mb-6">
                    <AlertDescription>{errorMsg}</AlertDescription>
                  </Alert>
                )}

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email Address</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="you@lawfirm.co.za" 
                              autoComplete="email"
                              className="h-11"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder="••••••••" 
                              autoComplete="current-password"
                              className="h-11"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      className="w-full h-11 text-base font-medium mt-2" 
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending ? "Signing in..." : "Sign In"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, GraduationCap, Users, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <header className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-primary-foreground font-bold">
            JH
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-gray-900">JOE Forge</span>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/sign-up">Apply Now</Link>
          </Button>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="px-6 py-24 md:py-32 max-w-7xl mx-auto relative overflow-hidden">
          <div className="max-w-3xl">
            <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight text-gray-900 leading-[1.1] mb-6">
              Your launchpad to a <span className="text-primary">tech career</span>.
            </h1>
            <p className="text-xl text-gray-600 mb-10 leading-relaxed max-w-2xl">
              JOE Forge is a rigorous, cohort-based scholarship training platform designed for driven individuals building their career from scratch. We hold you to a high bar because we believe in your potential.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="h-14 px-8 text-base shadow-sm" asChild>
                <Link href="/sign-up">
                  Start your application
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-14 px-8 text-base border-2" asChild>
                <Link href="/sign-in">Sign in to your dashboard</Link>
              </Button>
            </div>
          </div>

          <div className="absolute right-0 top-1/2 -translate-y-1/2 hidden lg:block opacity-10 pointer-events-none">
            <svg width="600" height="600" viewBox="0 0 100 100" fill="none" xmlns="http://www.svg.org/2000/svg">
              <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="2" />
              <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="2" />
              <circle cx="50" cy="50" r="20" stroke="currentColor" strokeWidth="2" />
              <path d="M 50 10 L 50 90" stroke="currentColor" strokeWidth="2" />
              <path d="M 10 50 L 90 50" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
        </section>

        {/* Features Section */}
        <section className="bg-gray-50 border-y border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-24">
            <div className="mb-16">
              <h2 className="text-3xl md:text-4xl font-display font-bold text-gray-900 mb-4">
                Not a generic LMS. A community of builders.
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl">
                We've built a platform that takes your growth seriously, combining structured learning with mentor guidance.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                {
                  icon: Users,
                  title: "Cohort-Based",
                  description: "Learn alongside peers who share your drive. Move through the program together and build lasting professional relationships."
                },
                {
                  icon: BookOpen,
                  title: "Structured Curriculum",
                  description: "Clear paths from zero to employable. No guessing what to learn next; just follow the roadmap."
                },
                {
                  icon: GraduationCap,
                  title: "Mentor Guidance",
                  description: "Get real feedback from industry professionals who review your assignments and guide your journey."
                },
                {
                  icon: Zap,
                  title: "High-Stakes",
                  description: "This is a serious commitment for serious individuals. We track progress strictly and expect excellence."
                }
              ].map((feature, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-6">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-6 py-32 max-w-7xl mx-auto text-center">
          <h2 className="text-4xl font-display font-bold text-gray-900 mb-6">Ready to put in the work?</h2>
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
            The scholarship is highly competitive. Show us your motivation and commitment to building a career in tech.
          </p>
          <Button size="lg" className="h-14 px-10 text-lg shadow-md" asChild>
            <Link href="/sign-up">Apply for the next cohort</Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-gray-200 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between text-sm text-gray-500 gap-4">
          <div className="flex items-center gap-2 font-bold text-gray-900">
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center text-primary-foreground text-xs">
              JH
            </div>
            JOE Forge
          </div>
          <div>© {new Date().getFullYear()} JOE Forge. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}

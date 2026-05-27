import { Features, Footer, Hero, Navbar, Stats, Testimonials, CtaSection } from "../components";

function LandingPage() {
  return (
    <main>
      <Navbar />
      <Hero />
      <Features />
      <Stats />
      <Testimonials />
      <CtaSection />
      <Footer />
    </main>
  );
}

export default LandingPage;

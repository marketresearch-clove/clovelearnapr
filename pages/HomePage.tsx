
import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

// Image URLs from design reference
const IMAGES = {
  bimWorkstation: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDTmCbUrqSnTgdFdYJb8CDJspZWKyoZQufK2jVLEEcIhlWZ6h3keQ2a2thQ9o467jt_YfsZ4VLirRWRsoBlppEwB3rqT1gQyRNc_QgbwAkU1Hd0x100gcwAJNM8AQl_4JdEjeESHmee0IH_5WGT6JbVaHV9oauY4aH2duUO5mNwMs_UTnSnyOcyfFZCCAHjwjElZsKUW9JvZlGRCutdnkEh0-fmIhsRjcbdJKrJfPtWS-hwD1fgsUYxzXXn1e3saK-JrHdHTjHYM8gQ',
  teamCollaboration: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBrcXCMcfj9iKGnnUgCvecD3CqPgyaRDMi0r5wz85yK54Vle8imNyyzTnLZFo3eqyKOyTN9pmXoSj5hNRogWXQZwy0Zi47D6uRCC22NHHanD_K74hH3ilISynvhwTu93gqdDYjvtXTsUEfPLL6kWa5XvyVATV-3nI1HGDYpn45-A1nCTB_Pe3LVdMkQ0z8XzGSxsrljGmQ0YkRMrD0zPEr-nBHuntGV9ZqdUm_opGfVlMLBRL68MW0Gf2Rx-Bf9Od3tc2EaXuvvxeId',
  advancedBIM: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB8YtwR4W5YNs0wfs6tC6J_5sSWNwaf6txNmHap0T5S2ddTAzyHee5LNdmiyjdxFLgI0GRT8F1waKL7v_k4zyjRFLut2wIY258OmbU1n6WlT1StL-KMas9FLQEiy81RJm8oLu-ajgXSCWhZHiUmTVafhMYzjAXv_JZp1TREuaLERACoB9VTfYi_0GD_tuBlQYu0sa2u96Ixu-nF16jdhZL7ZLKK42Ylz_AhYzDolQD08QIXGhzNWgOsuCujFrOk6q1bZ7XyolEg5uPf',
  scanData: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDGcqgiTURhOmWXxsXIU1Nv-zyake-sVpGrkc0N-eG3WRP1ALrtk5nDFnOiLNCEaPCsnHx-mCfKTRg12UzRXxfh_GfycQriOyvGl8Ka_i2GHJvznqt5LBmJmhU2Yl3A49_89Y_2ZPdCUlfoL2EbocTY_NLS_dAslRM6iYROveKdjkDUMbkMtlVq2bzWoQvhH5WgxPcvw0vEMDX5YvM6QOA3FjRtmasBQQ_0vEgWrb35lUdKyPXI4mAPseswxvhRyP73N_ycG2LprxKt',
  professional1: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC-mkN-VvMA922kQj2LymHtZz4fOHSNYJlTkHxYTUps5LeqoldS1OZbQ-9xfTD4uag1D9NXEKMDJwHJ0Adaap-or7Ya_k85xafn1ByAavFskgW4wQYvlL28hoK2Rcc7k8f-F_c3EW8WxjH9yymm2DCffGOmKq0RVGqgqCliIAt8YNjccyn1jQZ2nj7lKWeklgJPhSFzBwlBT19fP31h3fBq2mpMTtQO4Z_n1zqgdhle75KL4SatdyFVUZp97Vhgf9nxZ35MKY6DOAlg',
  professional2: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD_IQ1UGmP8VYxLvU9RLoDaYwO9xEo8lBPmFGmuOLMP0fmBRX8KG1vF3v7hu2KSobLcIS4czarOoNtRfg8q3d17bH-mOWxDVpFE5_VdBJcxliJVNgttMcs58gfS1MOpIFboee9uNmVGMOlSH4jse17t1gW6K-oJ48_56Sgl3Dq30xA3R8DdHTHpKL9Q4M8g5GtjQefBd4W3EECfAeePPIBYwagqn32cbKlpDcidb-JHt1itGif07yVL8RHlN-IYTnC4bDUmW6sUlj53',
  professional3: 'https://lh3.googleusercontent.com/aida-public/AB6AXuACz-URdWudj6yaCI9p5Aa65U0oecZ_sGPNzdiuYEfMlr2dXG3iIO6jayuMYwKrGH_THIRKsUaBZUr9FAhzULZ3KhRQvUpCaEEuGKIAMOJINxWvdPSunUkk0-IX1OWvxzTUOnbJtNh_BXcS-oC2Ho8z8TyGoeHzYQNZJnKNHXCJL_pNWY9TzL5jyrtQnXjkY2TzB1I7danS4VC27i_4W4TNQ3GVGsD0ngOmcqlriiGbtZotHIZiLtesp-PniL4XBNA1VeaYH6TevGsl',
};

const HomePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // If user is logged in, redirect to dashboard
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // Show loading while redirecting if user is logged in
  if (user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-on-surface-variant">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  // Landing page for non-authenticated users
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      {/* Fixed Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-surface/80 dark:bg-slate-950/80 backdrop-blur-xl shadow-[0px_20px_40px_rgba(50,41,79,0.06)]">
        <div className="flex justify-between items-center px-4 sm:px-6 md:px-12 py-4 sm:py-6 max-w-[1440px] mx-auto w-full">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-primary rounded flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-rounded text-white text-lg sm:text-xl">landscape</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold tracking-tighter text-primary">Clove LP</div>
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            <button
              onClick={() => navigate('/login')}
              className="hidden sm:block font-inter tracking-tight font-medium text-slate-600 dark:text-slate-400 hover:text-primary transition-all duration-300 ease-in-out active:scale-95 text-sm">
              Log In
            </button>
            <button
              onClick={() => navigate('/login')}
              className="bg-primary text-on-primary px-4 sm:px-6 py-2 sm:py-2.5 rounded-md font-bold transition-all duration-300 ease-in-out hover:opacity-90 active:scale-95 shadow-lg shadow-primary/20 text-sm sm:text-base">
              Get Started
            </button>
          </div>
        </div>
      </nav>

      <main className="pt-20 sm:pt-24 md:pt-32">
        {/* Hero Section */}
        <section className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-12 pb-12 sm:pb-16 md:pb-24 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 md:gap-12 items-center">
          {/* Hero Content */}
          <div className="lg:col-span-6 flex flex-col items-start text-left z-10">
            <div className="inline-flex items-center gap-2 px-2.5 sm:px-3 py-1 bg-surface-container-highest text-primary rounded-full mb-4 sm:mb-8">
              <span className="material-symbols-outlined text-base sm:text-lg">verified</span>
              <span className="font-label text-xs sm:text-sm font-bold uppercase tracking-widest">Enterprise BIM & CAD Learning</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-on-background leading-tight sm:leading-[0.9] tracking-tighter mb-4 sm:mb-6 md:mb-8">
              Master BIM. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-tertiary">Transform Your Practice.</span>
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-on-surface-variant max-w-[540px] leading-relaxed mb-6 sm:mb-8 md:mb-12">
              Elevate your AEC team with structured BIM, CAD, and scan-to-model workflows. Our platform transforms complex architectural knowledge into intuitive, scalable learning pathways.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 w-full sm:w-auto">
              <button
                onClick={() => navigate('/login')}
                className="bg-gradient-to-br from-primary to-primary-container text-on-primary px-6 sm:px-8 py-3 sm:py-5 rounded-md font-bold text-sm sm:text-lg transition-all hover:shadow-xl hover:shadow-primary/30 active:scale-95 flex items-center justify-center sm:justify-start gap-2">
                Explore Courses
                <span className="material-symbols-rounded text-base">arrow_forward</span>
              </button>
              <button
                className="bg-surface-container-highest text-primary px-6 sm:px-8 py-3 sm:py-5 rounded-md font-bold text-sm sm:text-lg transition-all hover:bg-surface-variant active:scale-95 flex items-center justify-center gap-2">
                View Demo
                <span className="material-symbols-rounded text-base">play_circle</span>
              </button>
            </div>
            <div className="mt-8 sm:mt-12 md:mt-16 flex flex-col sm:flex-row items-center gap-4 sm:gap-8 w-full sm:w-auto">
              <div className="flex -space-x-3 sm:-space-x-4">
                <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full border-3 sm:border-4 border-surface overflow-hidden bg-surface-container flex flex-shrink-0 items-center justify-center">
                  <img src={IMAGES.professional1} alt="Professional 1" className="w-full h-full object-cover" />
                </div>
                <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full border-3 sm:border-4 border-surface overflow-hidden bg-surface-container flex flex-shrink-0 items-center justify-center">
                  <img src={IMAGES.professional2} alt="Professional 2" className="w-full h-full object-cover" />
                </div>
                <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full border-3 sm:border-4 border-surface overflow-hidden bg-surface-container flex flex-shrink-0 items-center justify-center">
                  <img src={IMAGES.professional3} alt="Professional 3" className="w-full h-full object-cover" />
                </div>
              </div>
              <div>
                <div className="font-bold text-on-surface text-sm sm:text-base">500+ Professionals</div>
                <div className="text-xs sm:text-sm text-on-surface-variant">Building the future in AEC</div>
              </div>
            </div>
          </div>

          {/* Striking Visual - Grid */}
          <div className="lg:col-span-6 relative">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-6">
              <div className="space-y-3 sm:space-y-4 md:space-y-6 pt-0 sm:pt-4 md:pt-12">
                <div className="bg-surface-container-lowest rounded-lg sm:rounded-lg overflow-hidden shadow-[0px_20px_40px_rgba(50,41,79,0.06)] aspect-[4/5] relative group hover:shadow-xl transition-shadow">
                  <img
                    src={IMAGES.bimWorkstation}
                    alt="Modern BIM workstation with architect workspace"
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                </div>
                <div className="bg-primary p-3 sm:p-4 md:p-8 rounded-lg aspect-square flex flex-col justify-end gap-2">
                  <span className="material-symbols-outlined text-on-primary text-2xl sm:text-3xl md:text-4xl">build</span>
                  <h3 className="text-base sm:text-lg md:text-2xl font-bold text-on-primary tracking-tight leading-tight">Structured BIM Workflows</h3>
                </div>
              </div>
              <div className="space-y-3 sm:space-y-4 md:space-y-6">
                <div className="bg-surface-container-low rounded-lg p-0.5 aspect-square shadow-[0px_10px_20px_rgba(50,41,79,0.03)] hover:shadow-lg transition-shadow">
                  <div className="bg-surface-container-lowest w-full h-full rounded-md overflow-hidden relative">
                    <img
                      src={IMAGES.teamCollaboration}
                      alt="Collaborative AEC team working in a modern design studio"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <div className="bg-surface-container-highest rounded-lg overflow-hidden shadow-[0px_20px_40px_rgba(50,41,79,0.06)] aspect-[4/5] hover:shadow-xl transition-shadow">
                  <div className="p-3 sm:p-4 md:p-8 h-full flex flex-col justify-between">
                    <div className="flex justify-between items-start gap-2">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-white rounded-full flex items-center justify-center text-primary flex-shrink-0 shadow-sm">
                        <span className="material-symbols-outlined text-base sm:text-xl md:text-2xl">auto_awesome</span>
                      </div>
                      <span className="text-[9px] sm:text-xs font-black uppercase tracking-widest text-primary/40 flex-shrink-0">Certified</span>
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl md:text-4xl font-black text-primary mb-0.5 sm:mb-2">94%</div>
                      <div className="text-xs sm:text-sm font-medium text-on-surface-variant leading-tight">Completion rate across BIM masterclasses</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative Elements - Hidden on mobile */}
            <div className="hidden md:block absolute -top-12 -right-12 w-48 md:w-64 h-48 md:h-64 bg-secondary-container rounded-full mix-blend-multiply filter blur-3xl opacity-20 -z-10"></div>
            <div className="hidden md:block absolute -bottom-12 -left-12 w-48 md:w-64 h-48 md:h-64 bg-tertiary-container rounded-full mix-blend-multiply filter blur-3xl opacity-20 -z-10"></div>
          </div>
        </section>

        {/* Editorial Features Grid */}
        <section className="bg-surface-container-low py-12 sm:py-16 md:py-24 mt-12 sm:mt-16 md:mt-24">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-12">
            <div className="mb-8 sm:mb-12 md:mb-16">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-on-background tracking-tighter mb-3 sm:mb-4">Engineered for Excellence.</h2>
              <p className="text-sm sm:text-base text-on-surface-variant max-w-xl leading-relaxed">We've streamlined the chaos to create a focused learning environment where complex BIM workflows and technical skills actually stick.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 md:gap-12">
              <div className="flex flex-col">
                <span className="text-primary font-black text-xs uppercase tracking-[0.2em] mb-2 sm:mb-4">01. Industry-Grade</span>
                <h4 className="text-lg sm:text-xl md:text-2xl font-bold text-on-surface mb-2 sm:mb-4">Industry-Grade Modules</h4>
                <p className="text-xs sm:text-sm md:text-base text-on-surface-variant leading-relaxed">Lessons designed by BIM experts, broken into practical units for immediate application on real projects and workflows.</p>
              </div>
              <div className="flex flex-col">
                <span className="text-primary font-black text-xs uppercase tracking-[0.2em] mb-2 sm:mb-4">02. AI-Powered</span>
                <h4 className="text-lg sm:text-xl md:text-2xl font-bold text-on-surface mb-2 sm:mb-4">AI Course Builder</h4>
                <p className="text-xs sm:text-sm md:text-base text-on-surface-variant leading-relaxed">Intelligent content generation powered by AI. Create personalized learning paths and adapt courses in real-time.</p>
              </div>
              <div className="flex flex-col">
                <span className="text-primary font-black text-xs uppercase tracking-[0.2em] mb-2 sm:mb-4">03. Interactive</span>
                <h4 className="text-lg sm:text-xl md:text-2xl font-bold text-on-surface mb-2 sm:mb-4">Quiz & Assessments</h4>
                <p className="text-xs sm:text-sm md:text-base text-on-surface-variant leading-relaxed">Dynamic quiz modules with instant feedback. Track comprehension and identify knowledge gaps in real-time.</p>
              </div>
              <div className="flex flex-col">
                <span className="text-primary font-black text-xs uppercase tracking-[0.2em] mb-2 sm:mb-4">04. Analytics</span>
                <h4 className="text-lg sm:text-xl md:text-2xl font-bold text-on-surface mb-2 sm:mb-4">Skill Matrix & Reports</h4>
                <p className="text-xs sm:text-sm md:text-base text-on-surface-variant leading-relaxed">Track competencies with advanced skill matrix. Generate comprehensive reports on team performance and progress.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Pathways to Mastery Section */}
        <section className="py-12 sm:py-20 md:py-32 px-4 sm:px-6 md:px-12 max-w-[1440px] mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 sm:mb-12 md:mb-16 gap-4 sm:gap-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-2 sm:mb-4 block">Curated Pathways</span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter text-on-background">Upskilling Pathways</h2>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="text-primary font-bold flex items-center gap-2 hover:opacity-80 transition-opacity text-sm md:text-base">
              Browse All Courses
              <span className="material-symbols-outlined text-lg">north_east</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 md:gap-10">
            {/* Pathway Card 1 */}
            <div className="bg-surface-container-lowest rounded-lg sm:rounded-xl p-5 sm:p-8 md:p-10 flex flex-col gap-5 sm:gap-8 md:gap-10 hover:shadow-2xl transition-all border border-outline-variant/30 group">
              <div className="w-full h-40 sm:h-48 md:h-56 rounded-lg sm:rounded-xl overflow-hidden flex-shrink-0 relative group-hover:scale-105 transition-transform duration-700">
                <img
                  src={IMAGES.advancedBIM}
                  alt="Advanced BIM modeling visualization showing complex 3D architectural structures"
                  className="w-full h-full object-cover group-hover:shadow-md transition-shadow"
                />
              </div>
              <div className="flex flex-col justify-between flex-grow">
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2 sm:mb-4">
                    <h4 className="text-lg sm:text-xl md:text-2xl font-bold text-on-background tracking-tight">Advanced BIM Manager</h4>
                    <span className="bg-primary/10 text-primary text-[8px] sm:text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wider flex-shrink-0">Advanced</span>
                  </div>
                  <p className="text-xs sm:text-sm text-on-surface-variant mb-4 sm:mb-8 line-clamp-2">Master Revit coordination, scan-to-BIM workflows, and enterprise project delivery at scale.</p>
                </div>
                <div className="space-y-3 sm:space-y-5">
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest">
                    <span className="text-on-surface-variant">28 Modules</span>
                    <span className="text-on-surface-variant">72% Progress</span>
                  </div>
                  <div className="w-full bg-surface-container-high h-1.5 sm:h-2 rounded-full overflow-hidden">
                    <div className="bg-primary w-[72%] h-full rounded-full"></div>
                  </div>
                  <button
                    onClick={() => navigate('/login')}
                    className="w-full bg-on-background text-surface py-3 sm:py-4 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base hover:bg-primary transition-colors active:scale-95">Join Pathway</button>
                </div>
              </div>
            </div>

            {/* Pathway Card 2 */}
            <div className="bg-surface-container-lowest rounded-lg sm:rounded-xl p-5 sm:p-8 md:p-10 flex flex-col gap-5 sm:gap-8 md:gap-10 hover:shadow-2xl transition-all border border-outline-variant/30 group">
              <div className="w-full h-40 sm:h-48 md:h-56 rounded-lg sm:rounded-xl overflow-hidden flex-shrink-0 relative group-hover:scale-105 transition-transform duration-700">
                <img
                  src={IMAGES.scanData}
                  alt="Clean scan data processing interface showing point cloud visualization and CAD conversion workflow"
                  className="w-full h-full object-cover group-hover:shadow-md transition-shadow"
                />
              </div>
              <div className="flex flex-col justify-between flex-grow">
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2 sm:mb-4">
                    <h4 className="text-lg sm:text-xl md:text-2xl font-bold text-on-background tracking-tight">Scan-to-CAD Essentials</h4>
                    <span className="bg-tertiary-container text-on-tertiary-container text-[8px] sm:text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wider flex-shrink-0">Intermediate</span>
                  </div>
                  <p className="text-xs sm:text-sm text-on-surface-variant mb-4 sm:mb-8 line-clamp-2">From point cloud to production-ready CAD. Process lidar data and create accurate as-built documentation.</p>
                </div>
                <div className="space-y-3 sm:space-y-5">
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest">
                    <span className="text-on-surface-variant">20 Modules</span>
                    <span className="text-on-surface-variant">45% Progress</span>
                  </div>
                  <div className="w-full bg-surface-container-high h-1.5 sm:h-2 rounded-full overflow-hidden">
                    <div className="bg-primary w-[45%] h-full rounded-full"></div>
                  </div>
                  <button
                    onClick={() => navigate('/login')}
                    className="w-full bg-on-background text-surface py-3 sm:py-4 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base hover:bg-primary transition-colors active:scale-95">Join Pathway</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* AI-Powered Skill Assessment Section */}
        <section className="py-12 sm:py-20 md:py-32 bg-surface-container-highest px-4 sm:px-6 md:px-12">
          <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 md:gap-20 items-center">
            <div className="order-2 lg:order-1">
              <div className="relative bg-surface-container-lowest p-6 sm:p-8 md:p-12 rounded shadow-[0px_40px_80px_rgba(50,41,79,0.1)] overflow-hidden">
                {/* Simulated Skill Matrix */}
                <div className="flex justify-between items-center mb-6 sm:mb-8 md:mb-12">
                  <h5 className="font-black text-lg sm:text-xl tracking-tight text-on-background">Skill Assessment v3.1</h5>
                  <span className="material-symbols-outlined text-primary text-2xl sm:text-3xl flex-shrink-0">auto_awesome</span>
                </div>
                <div className="space-y-4 sm:space-y-6 md:space-y-8">
                  <div className="flex items-center gap-3 sm:gap-6">
                    <span className="w-16 sm:w-24 text-xs font-black text-primary uppercase tracking-[0.2em] flex-shrink-0">BIM Mgmt</span>
                    <div className="flex-grow flex gap-1 sm:gap-1.5">
                      <div className="h-6 sm:h-8 flex-grow bg-primary rounded-sm"></div>
                      <div className="h-6 sm:h-8 flex-grow bg-primary rounded-sm"></div>
                      <div className="h-6 sm:h-8 flex-grow bg-primary rounded-sm"></div>
                      <div className="h-6 sm:h-8 flex-grow bg-primary rounded-sm"></div>
                      <div className="h-6 sm:h-8 flex-grow bg-surface-container-highest rounded-sm"></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-6">
                    <span className="w-16 sm:w-24 text-xs font-black text-primary uppercase tracking-[0.2em] flex-shrink-0">Revit Exp</span>
                    <div className="flex-grow flex gap-1 sm:gap-1.5">
                      <div className="h-6 sm:h-8 flex-grow bg-primary rounded-sm"></div>
                      <div className="h-6 sm:h-8 flex-grow bg-primary rounded-sm"></div>
                      <div className="h-6 sm:h-8 flex-grow bg-primary rounded-sm"></div>
                      <div className="h-6 sm:h-8 flex-grow bg-surface-container-highest rounded-sm"></div>
                      <div className="h-6 sm:h-8 flex-grow bg-surface-container-highest rounded-sm"></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-6">
                    <span className="w-16 sm:w-24 text-xs font-black text-primary uppercase tracking-[0.2em] flex-shrink-0">Scan Data</span>
                    <div className="flex-grow flex gap-1 sm:gap-1.5">
                      <div className="h-6 sm:h-8 flex-grow bg-primary rounded-sm"></div>
                      <div className="h-6 sm:h-8 flex-grow bg-primary rounded-sm"></div>
                      <div className="h-6 sm:h-8 flex-grow bg-surface-container-highest rounded-sm"></div>
                      <div className="h-6 sm:h-8 flex-grow bg-surface-container-highest rounded-sm"></div>
                      <div className="h-6 sm:h-8 flex-grow bg-surface-container-highest rounded-sm"></div>
                    </div>
                  </div>
                </div>
                <div className="mt-6 sm:mt-8 md:mt-12 pt-4 sm:pt-6 md:pt-8 border-t border-outline-variant/30">
                  <p className="text-xs sm:text-sm text-on-surface-variant italic font-medium leading-relaxed">"Your team improved BIM coordination efficiency by 31% in Q1 after completing the master pathway."</p>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter text-on-background mb-4 sm:mb-6 md:mb-8 leading-tight md:leading-[1.1]">
                Intelligent Skill Discovery
              </h2>
              <p className="text-sm sm:text-base md:text-lg lg:text-xl text-on-surface-variant mb-6 sm:mb-8 md:mb-12 leading-relaxed">
                Track your team's real competencies with our AI-powered skill matrix. Identify expertise gaps, certifications needed, and emerging talent within your organization.
              </p>
              <ul className="space-y-4 sm:space-y-6 md:space-y-8">
                <li className="flex items-start gap-3 sm:gap-5">
                  <span className="material-symbols-outlined text-primary text-2xl sm:text-3xl mt-0.5 flex-shrink-0">check_circle</span>
                  <div>
                    <span className="font-bold text-lg sm:text-xl text-on-background block mb-1 sm:mb-2">Competency Mapping</span>
                    <p className="text-xs sm:text-sm md:text-base text-on-surface-variant leading-relaxed">Identify skill gaps before they impact project delivery, ensuring your team stays ahead of industry demands.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3 sm:gap-5">
                  <span className="material-symbols-outlined text-primary text-2xl sm:text-3xl mt-0.5 flex-shrink-0">check_circle</span>
                  <div>
                    <span className="font-bold text-lg sm:text-xl text-on-background block mb-1 sm:mb-2">Performance Analytics</span>
                    <p className="text-xs sm:text-sm md:text-base text-on-surface-variant leading-relaxed">Real-time insights into your team's technical proficiency and certification status across all BIM disciplines.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12 sm:py-20 md:py-32 px-4 sm:px-6 md:px-12">
          <div className="max-w-[1440px] mx-auto bg-on-background rounded-lg sm:rounded-xl p-6 sm:p-12 md:p-16 lg:p-24 relative overflow-hidden text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-8 md:gap-16">
            <div className="absolute top-0 right-0 w-48 sm:w-64 md:w-96 h-48 sm:h-64 md:h-96 bg-primary/30 blur-[80px] sm:blur-[100px] md:blur-[120px] rounded-full"></div>
            <div className="absolute bottom-0 left-0 w-48 sm:w-64 md:w-96 h-48 sm:h-64 md:h-96 bg-tertiary-container/20 blur-[80px] sm:blur-[100px] md:blur-[120px] rounded-full"></div>
            <div className="relative z-10 max-w-2xl">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black tracking-tighter text-on-primary mb-4 sm:mb-6 md:mb-8 leading-tight md:leading-[1.1]">
                Start Your Upskilling Journey Today
              </h2>
              <p className="text-sm sm:text-base md:text-lg lg:text-xl text-on-primary/70 leading-relaxed">Join 500+ AEC professionals mastering BIM, CAD, and modern construction workflows with Clove LP.</p>
            </div>
            <div className="relative z-10 flex flex-col gap-3 sm:gap-4 md:gap-6 w-full md:w-auto">
              <button
                onClick={() => navigate('/login')}
                className="bg-primary text-on-primary px-6 sm:px-12 py-3 sm:py-6 rounded-md font-black text-base sm:text-lg md:text-xl hover:scale-105 transition-transform shadow-[0px_20px_40px_rgba(78,70,209,0.3)]">
                Schedule a Demo
              </button>
              <button
                onClick={() => navigate('/login')}
                className="text-on-primary/60 hover:text-on-primary font-bold transition-colors uppercase tracking-[0.2em] text-xs sm:text-sm">
                Start Learning Today
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-outline-variant/20 bg-surface-container-low mt-12 sm:mt-16 md:mt-24">
        <div className="flex flex-col gap-6 md:gap-0 md:flex-row justify-between items-center px-4 sm:px-6 md:px-12 py-8 sm:py-12 md:py-16 w-full max-w-[1440px] mx-auto">
          <div className="flex items-center gap-2 text-primary">
            <div className="w-5 h-5 sm:w-6 sm:h-6 bg-primary rounded flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-rounded text-white text-xs sm:text-sm">landscape</span>
            </div>
            <div className="font-black text-base sm:text-lg">Clove Learning Platform</div>
          </div>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 md:gap-10 font-inter text-xs sm:text-sm tracking-wide uppercase">
            <a className="text-slate-500 dark:text-slate-400 hover:text-primary transition-colors focus:ring-2 focus:ring-primary/20" href="#">
              Privacy Policy
            </a>
            <a className="text-slate-500 dark:text-slate-400 hover:text-primary transition-colors focus:ring-2 focus:ring-primary/20" href="#">
              Terms of Service
            </a>
            <a className="text-slate-500 dark:text-slate-400 hover:text-primary transition-colors focus:ring-2 focus:ring-primary/20" href="#">
              Accessibility
            </a>
          </div>
          <div className="flex flex-col items-center gap-1 sm:gap-2 text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
            <div>© 2026 Clove Learning Platform. All rights reserved.</div>
            <div className="text-[10px] sm:text-xs">Developed by Yuva Subharam Vasamsetti</div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;

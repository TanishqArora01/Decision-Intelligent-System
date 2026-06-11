import React from 'react';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, Server, Activity, Database, Lock, Zap } from 'lucide-react';
import Image from 'next/image';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-700 rounded shadow flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-gray-900">Ritam Guard</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="#architecture" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Architecture</Link>
          <Link href="#compliance" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Compliance</Link>
          <Link href="#benchmarks" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Benchmarks</Link>
          <Link href="/login" className="text-sm font-medium text-blue-700 hover:text-blue-800 transition-colors">Platform Login</Link>
          <Link href="/login" className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-md shadow-sm transition-all flex items-center gap-2">
            Access Sandbox <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-6 py-24 max-w-6xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold uppercase tracking-wider mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          Production Ready for India
        </div>
        <h1 className="text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 mb-6 leading-tight">
          Autonomous Risk & Decision <br className="hidden lg:block"/> Operations Platform
        </h1>
        <p className="text-lg text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
          Bank-grade infrastructure for real-time fraud detection. Built on Kafka-compatible streaming, Explainable AI (XAI), and strictly aligned with RBI, DPDP, and CERT-In mandates.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/login" className="w-full sm:w-auto px-6 py-3 bg-blue-700 hover:bg-blue-800 text-white text-base font-semibold rounded-md shadow-md transition-all">
            Deploy Sandbox Workspace
          </Link>
          <a href="#architecture" className="w-full sm:w-auto px-6 py-3 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-base font-semibold rounded-md shadow-sm transition-all">
            View Technical Architecture
          </a>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="border-y border-gray-200 bg-white py-8">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">Built for Regulated Financial Institutions</p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-70 grayscale">
            <div className="flex items-center gap-2 text-gray-600 font-bold text-xl"><ShieldCheck/> RBI Aligned</div>
            <div className="flex items-center gap-2 text-gray-600 font-bold text-xl"><Lock/> DPDP Act</div>
            <div className="flex items-center gap-2 text-gray-600 font-bold text-xl"><Server/> CERT-In Ready</div>
            <div className="flex items-center gap-2 text-gray-600 font-bold text-xl"><Zap/> PCI-DSS Roadmap</div>
          </div>
        </div>
      </section>

      {/* Operational Benchmarks */}
      <section id="benchmarks" className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Enterprise Performance Benchmarks</h2>
            <p className="text-gray-600">Engineered for the demands of UPI and IMPS real-time transaction volumes.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
              <Zap className="w-8 h-8 text-blue-600 mb-4" />
              <div className="text-4xl font-extrabold text-gray-900 mb-2">&lt; 50ms</div>
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide">p95 End-to-End Latency</div>
              <p className="text-gray-600 text-sm mt-3">Guaranteed response times to prevent payment gateway timeouts during step-up auth.</p>
            </div>
            <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
              <Activity className="w-8 h-8 text-blue-600 mb-4" />
              <div className="text-4xl font-extrabold text-gray-900 mb-2">&gt; 50K</div>
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Events / Sec Throughput</div>
              <p className="text-gray-600 text-sm mt-3">Powered by Redpanda (Kafka-compatible) streaming architecture for peak holiday loads.</p>
            </div>
            <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
              <ShieldCheck className="w-8 h-8 text-blue-600 mb-4" />
              <div className="text-4xl font-extrabold text-gray-900 mb-2">99.95%</div>
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide">System Uptime SLA</div>
              <p className="text-gray-600 text-sm mt-3">High-availability deployment models across multiple availability zones with active failover.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Overview */}
      <section id="architecture" className="py-24 bg-white border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="lg:flex gap-16 items-center">
            <div className="lg:w-1/2 mb-12 lg:mb-0">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Multi-Tenant Institutional Architecture</h2>
              <ul className="space-y-6">
                <li className="flex gap-4">
                  <div className="mt-1 bg-blue-100 p-2 rounded-lg h-min"><Database className="w-5 h-5 text-blue-700" /></div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">Strict Tenant Isolation</h3>
                    <p className="text-gray-600 text-sm mt-1">Row-level security and dedicated VPC subdomains (`bankname.platform.com`) ensure your data never crosses boundaries.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="mt-1 bg-blue-100 p-2 rounded-lg h-min"><Server className="w-5 h-5 text-blue-700" /></div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">Provider-Agnostic AI</h3>
                    <p className="text-gray-600 text-sm mt-1">Not locked to a single LLM. Abstraction layers allow swapping between OpenAI, Anthropic, or self-hosted vLLM based on sovereignty needs.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="mt-1 bg-blue-100 p-2 rounded-lg h-min"><Lock className="w-5 h-5 text-blue-700" /></div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">Explainable by Default</h3>
                    <p className="text-gray-600 text-sm mt-1">Every decision generates an auditable, deterministic trace. No black-box AI rejections.</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="lg:w-1/2 bg-gray-50 rounded-2xl border border-gray-200 p-8 shadow-inner">
              <div className="space-y-4">
                <div className="bg-white p-4 rounded border border-gray-200 shadow-sm text-sm font-mono text-gray-600 flex justify-between items-center">
                  <span>API Gateway (Kong/NGINX)</span> <Lock className="w-4 h-4"/>
                </div>
                <div className="flex justify-center text-gray-400">↓</div>
                <div className="bg-white p-4 rounded border border-gray-200 shadow-sm text-sm font-mono text-blue-700 flex justify-between items-center border-l-4 border-l-blue-600">
                  <span>FastAPI Decision Core</span> <Activity className="w-4 h-4"/>
                </div>
                <div className="flex justify-center text-gray-400">↓</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded border border-gray-200 shadow-sm text-sm font-mono text-purple-700 border-t-2 border-t-purple-500 text-center">
                    Redpanda Streaming
                  </div>
                  <div className="bg-white p-4 rounded border border-gray-200 shadow-sm text-sm font-mono text-green-700 border-t-2 border-t-green-500 text-center">
                    PostgreSQL (RLS)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 border-t border-gray-800">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-blue-500" />
            <span className="font-bold text-lg">Ritam Guard</span>
          </div>
          <div className="text-sm text-gray-400">
            © 2026 Ritam Guard Inc. All rights reserved. SOC 2 Type II compliant.
          </div>
        </div>
      </footer>
    </div>
  );
}

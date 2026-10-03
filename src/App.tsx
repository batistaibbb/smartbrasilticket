import React, { useState, ReactNode, useContext, useEffect } from 'react';
import { AuthProvider as SupabaseAuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider as SupabaseDataProvider, useData } from './contexts/DataContext';
import EventForm from './components/EventForm';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import {
  Trophy, Calendar, MapPin, Users, Star, Search,
  User, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft,
  LogOut, LayoutDashboard, CreditCard, FileText, CheckCircle,
  QrCode, Copy, Check, Shield, Download, Plus, Edit, Trash2,
  DollarSign, AlertCircle, Phone, Heart, Share2, RefreshCw,
  Unlock, Eye as EyeIcon, Printer, XCircle, Clock
} from 'lucide-react';

import { Race, Registration, Payment } from './types';

// ============================================
// Compatibilidade: os Providers reais e o useAuth/useData
// agora vivem em src/contexts/AuthContext.tsx e src/contexts/DataContext.tsx
// (com suporte a Supabase + modo demo via localStorage).
// Estes aliases mantêm os componentes antigos desta página funcionando.
// ============================================
const AuthProvider = SupabaseAuthProvider;
const DataProvider = SupabaseDataProvider;

// Componente ProtectedRoute
function ProtectedRoute({ children, requiredRole }: { children: ReactNode; requiredRole?: 'admin' | 'participant' }) {
  const { user } = useAuth();
  if (!user) return <Link to="/login" className="block text-center py-20 text-emerald-600">Faça login para continuar →</Link>;
  const userRole = user.role as string;
  if (requiredRole && userRole !== requiredRole && userRole !== 'admin') {
    return <div className="text-center py-20">
      <p className="text-xl text-gray-700 mb-4">Acesso negado</p>
      <Link to="/" className="text-emerald-600 hover:underline">Voltar para a página inicial →</Link>
    </div>;
  }
  return <>{children}</>;
}

// Header Component
function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-3">
            <div className="bg-emerald-600 p-2.5 rounded-lg">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold text-slate-900 tracking-tight">
              Smart Brasil Ticket
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                {user.role === 'admin' && (
                  <Link to="/admin" className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors">
                    <LayoutDashboard className="w-4 h-4" />
                    Admin
                  </Link>
                )}
                <Link to="/meus-comprovantes" className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:border-emerald-400 transition-colors">
                  <FileText className="w-4 h-4" />
                  Comprovantes
                </Link>
                <Link to="/minha-conta" className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:border-emerald-400 transition-colors">
                  <div className="w-7 h-7 bg-emerald-600 rounded-full flex items-center justify-center">
                    <span className="text-xs font-semibold text-white">{user.name.charAt(0)}</span>
                  </div>
                  {user.name.split(' ')[0]}
                </Link>
                <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-emerald-600 transition-colors" title="Sair">
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:border-emerald-400 transition-colors">
                  <User className="w-4 h-4" />
                  Entrar
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

// HomePage Component
function HomePage() {
  const { races } = useData();
  const [search, setSearch] = useState('');

  const filtered = races.filter((r: Race) =>
    r.published && r.registrationStatus !== 'finished' &&
    (r.name.toLowerCase().includes(search.toLowerCase()) || r.city.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-emerald-700 via-emerald-600 to-sky-600 py-28 overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4">
          <div className="text-center mb-14">
            <div className="inline-block mb-5">
              <span className="px-5 py-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-medium rounded-full">
                +500 eventos disponíveis em todo Brasil
              </span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight tracking-tight">
              Encontre seu próximo<br />
              <span className="text-emerald-100">desafio esportivo</span>
            </h1>
            <p className="text-lg text-emerald-50 mb-10 max-w-2xl mx-auto leading-relaxed">
              A plataforma completa para inscrição em eventos esportivos. 
              Corridas, ciclismo, triathlon e muito mais.
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-xl shadow-2xl p-1.5 flex items-center gap-2">
              <div className="flex-1 flex items-center gap-3 px-5">
                <Search className="w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar evento, cidade ou modalidade..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full py-3.5 text-base text-slate-900 placeholder-slate-400 focus:outline-none"
                />
              </div>
              <button className="px-8 py-3.5 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors">
                Buscar
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Events Grid */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">
              {filtered.length} {filtered.length === 1 ? 'evento encontrado' : 'eventos encontrados'}
            </h2>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <Search className="w-10 h-10 text-emerald-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Nenhum evento encontrado</h3>
            <p className="text-slate-500 mb-8">Tente buscar por outro termo</p>
            <button
              onClick={() => setSearch('')}
              className="px-6 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Limpar busca
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((race: Race) => (
              <Link
                key={race.id}
                to={`/evento/${race.id}`}
                className="group bg-white rounded-xl overflow-hidden border border-slate-200 hover:border-emerald-300 hover:shadow-lg transition-all duration-300"
              >
                <div className="relative h-52 overflow-hidden bg-slate-100">
                  <img
                    src={race.image}
                    alt={race.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                  
                  <div className="absolute top-4 right-4">
                    <span className={`px-3 py-1.5 text-xs font-semibold rounded ${
                      race.registrationStatus === 'upcoming' ? 'bg-emerald-500 text-white' :
                      race.registrationStatus === 'closed' ? 'bg-slate-500 text-white' :
                      'bg-slate-700 text-white'
                    }`}>
                      {race.registrationStatus === 'upcoming' ? 'Inscrições Abertas' :
                       race.registrationStatus === 'closed' ? 'Inscrições Encerradas' :
                       'Evento Encerrado'}
                    </span>
                  </div>

                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="text-2xl font-bold text-white">
                      R$ {Math.min(...(race.kits?.map(k => k.price) || race.includes.map(() => 0))).toFixed(2).replace('.', ',')}
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="font-semibold text-slate-900 text-lg mb-4 line-clamp-2 group-hover:text-emerald-600 transition-colors">
                    {race.name}
                  </h3>
                  
                  <div className="space-y-2.5 mb-5">
                    <div className="flex items-center gap-2.5 text-sm text-slate-600">
                      <Calendar className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span>{format(parseISO(race.date), "dd 'de' MMMM, yyyy", { locale: ptBR })}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-sm text-slate-600">
                      <MapPin className="w-4 h-4 text-sky-500 flex-shrink-0" />
                      <span className="truncate">{race.city}, {race.state}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
                    {(race.kits || []).slice(0, 3).map((kit: any, i: number) => (
                      <span
                        key={kit.id || i}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded"
                      >
                        {kit.name}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center">
            <p>&copy; 2024 Smart Brasil Ticket. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Continue com os outros componentes...
export default function App() {
  return (
    <Router>
      <AuthProvider>
        <DataProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
          </Routes>
        </DataProvider>
      </AuthProvider>
    </Router>
  );
}

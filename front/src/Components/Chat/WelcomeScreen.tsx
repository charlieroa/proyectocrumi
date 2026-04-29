import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { X } from 'lucide-react';
import { getDecodedToken } from '../../services/auth';
import { sendMessage } from '../../slices/crumiChat/thunks';
import { agents, type Agent } from '../../data/agents';

const WelcomeScreen: React.FC = () => {
  const dispatch = useDispatch<any>();
  const decoded = getDecodedToken();
  const cachedProfile = (() => {
    try { return JSON.parse(sessionStorage.getItem('crumi-user-profile') || 'null'); } catch { return null; }
  })();
  const firstName = (cachedProfile?.first_name || decoded?.user?.first_name || decoded?.user?.name || 'Usuario').split(' ')[0];
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const handleQuickChat = (agent: Agent) => {
    dispatch(sendMessage(agent.prompt, null, agent.id));
  };

  const featured = agents[0]; // Santiago - Asistente General
  const otherAgents = agents.slice(1);

  return (
    <div className="flex flex-col h-full overflow-y-auto crumi-scrollbar">
      <div className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 sm:px-6 sm:py-8">
        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 dark:text-white text-crumi-text-primary">
            Hola, {firstName}
          </h1>
          <p className="text-lg text-crumi-text-muted dark:text-crumi-text-dark-muted">
            Elige un agente o escribe lo que necesites
          </p>
        </div>

        {/* Featured Agent */}
        <div
          className="group w-full text-left mb-8 rounded-2xl overflow-hidden
            bg-gradient-to-br from-slate-500/10 to-slate-700/10
            dark:from-slate-500/20 dark:to-slate-700/20
            dark:bg-[#1E2124]
            border border-slate-200/50 dark:border-slate-400/30
            hover:border-slate-300 dark:hover:border-slate-400/50
            hover:shadow-lg dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)]
            transition-all duration-300"
        >
          <div className="flex items-center gap-5 p-6">
            <div className="relative shrink-0">
              <img
                src={featured.avatar}
                alt={featured.name}
                className="w-20 h-20 rounded-2xl object-cover ring-3 ring-slate-400/40
                  group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-400 rounded-full border-2 border-crumi-surface-light dark:border-[#1E2124]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-xl font-bold dark:text-white text-crumi-text-primary">
                  {featured.name}
                </h3>
                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full text-white ${featured.pillBg}`}>
                  {featured.role}
                </span>
              </div>
              <p className="text-sm text-crumi-text-muted dark:text-crumi-text-dark-muted mb-2">
                {featured.description}
              </p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {featured.specialties.slice(0, 6).map((s) => (
                  <span key={s} className="text-[10px] font-medium px-2 py-0.5 rounded-full
                    bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
                    {s}
                  </span>
                ))}
              </div>
              <button
                onClick={() => handleQuickChat(featured)}
                className={`text-sm font-semibold py-2 px-5 rounded-xl text-white
                  bg-gradient-to-r ${featured.gradient} hover:opacity-90
                  transition-all duration-200`}
              >
                Empezar a hablar con {featured.name}
              </button>
            </div>
          </div>
        </div>

        {/* Section title */}
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-lg font-bold dark:text-white text-crumi-text-primary">
            Agentes Especializados
          </h2>
          <div className="flex-1 border-t border-gray-200 dark:border-gray-600" />
        </div>

        {/* Agent Cards Grid - Marketplace */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {otherAgents.map((agent) => (
            <div
              key={agent.id}
              className="group relative flex flex-col rounded-2xl
                bg-crumi-surface-light dark:bg-[#1E2124]
                border border-gray-100 dark:border-gray-600/70
                ring-0 dark:ring-1 dark:ring-white/[0.06]
                hover:border-gray-200 dark:hover:border-gray-400/50
                hover:shadow-lg dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]
                transition-all duration-300"
            >
              {/* Card header with gradient */}
              <div className={`h-16 rounded-t-2xl bg-gradient-to-r ${agent.gradient} opacity-80 dark:opacity-100`} />

              {/* Avatar overlapping header */}
              <div className="relative z-10 px-5 -mt-10">
                <img
                  src={agent.avatar}
                  alt={agent.name}
                  className={`w-16 h-16 rounded-xl object-cover ring-3 ${agent.ring}/40
                    border-2 border-crumi-surface-light dark:border-[#1E2124]
                    group-hover:scale-105 transition-transform duration-300`}
                />
              </div>

              {/* Content */}
              <div className="flex flex-col flex-1 px-5 pt-3 pb-5">
                <div className="flex items-center gap-2 mb-1.5">
                  <h3 className="text-base font-bold dark:text-white text-crumi-text-primary">
                    {agent.name}
                  </h3>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full text-white ${agent.pillBg}`}>
                    {agent.role}
                  </span>
                </div>

                <p className="text-sm text-crumi-text-muted dark:text-gray-300 mb-3 line-clamp-2 flex-1">
                  {agent.description}
                </p>

                {/* Specialties */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {agent.specialties.slice(0, 3).map((s) => (
                    <span key={s} className="text-[11px] font-medium px-2 py-0.5 rounded-full
                      bg-gray-100 text-gray-600 dark:bg-gray-700/70 dark:text-gray-200">
                      {s}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleQuickChat(agent)}
                    className={`flex-1 text-sm font-semibold py-2 rounded-xl text-white
                      bg-gradient-to-r ${agent.gradient} hover:opacity-90
                      transition-all duration-200`}
                  >
                    Chatear
                  </button>
                  <button
                    onClick={() => setSelectedAgent(agent)}
                    className="px-3 py-2 text-sm font-semibold rounded-xl
                      border border-gray-200 dark:border-gray-500/70
                      text-crumi-text-muted dark:text-crumi-text-dark-muted
                      hover:bg-gray-50 dark:hover:bg-gray-700/70
                      transition-all duration-200"
                  >
                    Ver mas
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedAgent(null)}
        >
          <div
            className="relative w-full max-w-md rounded-3xl overflow-hidden
              bg-crumi-surface-light dark:bg-[#1E2124] shadow-2xl
              animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header gradient */}
            <div className={`h-24 bg-gradient-to-r ${selectedAgent.gradient}`} />

            {/* Close button */}
            <button
              onClick={() => setSelectedAgent(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
            >
              <X size={18} />
            </button>

            {/* Avatar */}
            <div className="flex justify-center -mt-14">
              <img
                src={selectedAgent.avatar}
                alt={selectedAgent.name}
                className={`w-24 h-24 rounded-2xl object-cover ring-4 ${selectedAgent.ring}/50
                  border-3 border-crumi-surface-light dark:border-[#1E2124]`}
              />
            </div>

            {/* Content */}
            <div className="px-6 pt-4 pb-6">
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold dark:text-white text-crumi-text-primary mb-1">
                  {selectedAgent.name}
                </h3>
                <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full text-white ${selectedAgent.pillBg}`}>
                  {selectedAgent.role}
                </span>
              </div>

              <p className="text-sm text-crumi-text-muted dark:text-crumi-text-dark-muted mb-5 text-center leading-relaxed">
                {selectedAgent.longDescription}
              </p>

              {/* Specialties */}
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-crumi-text-muted dark:text-crumi-text-dark-muted mb-2">
                  Especialidades
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedAgent.specialties.map((s) => (
                    <span key={s} className="text-[11px] font-medium px-2.5 py-1 rounded-full
                      bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-300">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={() => {
                  handleQuickChat(selectedAgent);
                  setSelectedAgent(null);
                }}
                className={`w-full py-3 rounded-xl text-sm font-bold text-white
                  bg-gradient-to-r ${selectedAgent.gradient} hover:opacity-90
                  transition-all duration-200`}
              >
                Chatear con {selectedAgent.name}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WelcomeScreen;

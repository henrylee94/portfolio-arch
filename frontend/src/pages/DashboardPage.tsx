import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

// ─── Types ──────────────────────────────────────────────────────
interface Component {
  id: string;
  name: string;
  type: string;
  status: string;
  description: string;
}

interface Flow {
  from: string;
  to: string;
  label: string;
  protocol: string;
}

interface FlowEvent {
  eventType: string;
  aggregateId: string;
  timestamp: string;
  topic: string;
  status: string;
}

interface DashboardData {
  components: Component[];
  flows: Flow[];
  recentEvents: FlowEvent[];
  timestamp: string;
}

// ─── Component card icon map ────────────────────────────────────
const typeIcons: Record<string, string> = {
  frontend: '🖥️',
  backend: '⚡',
  auth: '🔐',
  database: '🗄️',
  cache: '🚀',
  'event-bus': '📡',
  workflow: '⚙️',
};

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  connected: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  healthy: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  degraded: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  disconnected: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const eventStatusColors: Record<string, string> = {
  published: 'bg-blue-500/20 text-blue-400',
  consumed: 'bg-emerald-500/20 text-emerald-400',
  failed: 'bg-red-500/20 text-red-400',
};

const workflowStatusColors: Record<string, string> = {
  COMPLETED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  RUNNING: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  FAILED: 'bg-red-500/20 text-red-400 border-red-500/30',
  PENDING: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  TIMED_OUT: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const mockWorkflows = [
  {
    workflowId: 'wf_001_register',
    workflowType: 'UserRegistrationWorkflow',
    status: 'COMPLETED',
    runId: 'run_abc123',
    startTime: new Date(Date.now() - 3600000).toISOString(),
    closeTime: new Date(Date.now() - 3595000).toISOString(),
    traceId: 'trace_mswlgtf8_6a2deafe',
    activities: [
      { name: 'validateInput', status: 'COMPLETED', duration: '12ms' },
      { name: 'hashPassword', status: 'COMPLETED', duration: '45ms' },
      { name: 'createUser', status: 'COMPLETED', duration: '23ms' },
      { name: 'sendWelcomeEmail', status: 'COMPLETED', duration: '120ms' },
    ],
  },
  {
    workflowId: 'wf_002_login',
    workflowType: 'UserLoginWorkflow',
    status: 'COMPLETED',
    runId: 'run_def456',
    startTime: new Date(Date.now() - 1800000).toISOString(),
    closeTime: new Date(Date.now() - 1798000).toISOString(),
    traceId: 'trace_mswlgtgk_3cd997fb',
    activities: [
      { name: 'lookupUser', status: 'COMPLETED', duration: '8ms' },
      { name: 'verifyPassword', status: 'COMPLETED', duration: '35ms' },
      { name: 'generateToken', status: 'COMPLETED', duration: '15ms' },
    ],
  },
  {
    workflowId: 'wf_003_order',
    workflowType: 'OrderProcessingWorkflow',
    status: 'RUNNING',
    runId: 'run_ghi789',
    startTime: new Date(Date.now() - 60000).toISOString(),
    closeTime: null,
    traceId: 'trace_mswlgthu_39448b62',
    activities: [
      { name: 'validateOrder', status: 'COMPLETED', duration: '18ms' },
      { name: 'reserveInventory', status: 'COMPLETED', duration: '52ms' },
      { name: 'processPayment', status: 'RUNNING', duration: '...' },
      { name: 'shipOrder', status: 'PENDING', duration: '-' },
    ],
  },
  {
    workflowId: 'wf_004_saga',
    workflowType: 'OrderSagaWorkflow',
    status: 'PENDING',
    runId: null,
    startTime: null,
    closeTime: null,
    traceId: null,
    activities: [
      { name: 'createOrder', status: 'PENDING', duration: '-' },
      { name: 'processPayment', status: 'PENDING', duration: '-' },
      { name: 'confirmOrder', status: 'PENDING', duration: '-' },
      { name: 'compensate', status: 'PENDING', duration: '-' },
    ],
  },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'flow' | 'events' | 'workflow' | 'code'>('flow');

  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await api.get('/dashboard/flow');
      setData(response.data);
      setError('');
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    console.log('[Dashboard] useEffect fired, token:', token ? 'present' : 'missing');
    if (!token) { navigate('/login'); return; }
    console.log('[Dashboard] calling fetchDashboard...');
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 5000);
    return () => clearInterval(interval);
  }, [token, navigate, fetchDashboard]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Loading architecture...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">⚠️ {error}</p>
          <p className="text-zinc-500 text-sm mb-4">Make sure the backend is running on port 3000</p>
          <button onClick={fetchDashboard} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-500">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="border-b border-white/5 bg-gradient-to-r from-[#0a0a0f] via-indigo-950/20 to-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-sm font-bold shadow-lg shadow-indigo-500/25">H</div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Portfolio Architecture</h1>
              <p className="text-xs text-zinc-500 mt-0.5">Solution Architect Demo — DDD + Event-Driven</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-zinc-400 bg-white/5 px-3 py-1.5 rounded-full">{user?.email}</span>
            <button onClick={handleLogout} className="text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-full border border-white/10 hover:border-white/20 transition-all">Logout</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* ── Tabs ────────────────────────────────────────── */}
        <div className="flex gap-1 mb-8 bg-white/[0.03] p-1 rounded-lg w-fit">
          {(['flow', 'events', 'workflow', 'code'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab === 'flow' ? '🏗️ Architecture Flow' : tab === 'events' ? '📡 Event Stream' : tab === 'workflow' ? '⚡ Temporal Workflows' : '💻 Code Guide'}
            </button>
          ))}
        </div>

        {/* ── Architecture Flow Tab ────────────────────────── */}
        {activeTab === 'flow' && data && (
          <div className="space-y-8">
            {/* Component cards */}
            <section>
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-5">Infrastructure Components</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {data.components.map(comp => (
                  <div key={comp.id} className="relative bg-white/[0.03] backdrop-blur-sm border border-white/5 rounded-2xl p-5 hover:border-indigo-500/30 hover:bg-white/[0.05] transition-all duration-300 group overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-2xl">{typeIcons[comp.type] || '📦'}</span>
                        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${statusColors[comp.status] || 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'}`}>
                          {comp.status}
                        </span>
                      </div>
                      <h3 className="font-semibold text-white text-sm mb-1.5">{comp.name}</h3>
                      <p className="text-xs text-zinc-500 leading-relaxed">{comp.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Data flow visualization */}
            <section>
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-5">Data Flow</h2>
              <div className="bg-white/[0.03] backdrop-blur-sm border border-white/5 rounded-2xl p-6 overflow-x-auto">
                <div className="flex flex-col gap-3 min-w-[600px]">
                  {data.flows.map((flow, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm group">
                      <span className="w-36 text-right text-indigo-400 font-mono text-xs truncate">{flow.from}</span>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 h-px bg-gradient-to-r from-indigo-500/50 to-violet-500/50 group-hover:from-indigo-400 group-hover:to-violet-400 transition-all duration-300" />
                        <span className="text-[10px] text-zinc-400 bg-white/5 px-2.5 py-1 rounded-md whitespace-nowrap font-medium">{flow.label}</span>
                        <span className="text-[10px] text-zinc-600 whitespace-nowrap">({flow.protocol})</span>
                        <div className="flex-1 h-px bg-gradient-to-r from-violet-500/50 to-indigo-500/50 group-hover:from-violet-400 group-hover:to-indigo-400 transition-all duration-300" />
                        <span className="text-indigo-400/60">→</span>
                      </div>
                      <span className="w-36 text-left text-violet-400 font-mono text-xs truncate">{flow.to}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ── Event Stream Tab ─────────────────────────────── */}
        {activeTab === 'events' && data && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Recent Events</h2>
              <span className="text-xs text-zinc-500 bg-white/5 px-3 py-1.5 rounded-full font-mono">Topic: {data.recentEvents.length > 0 ? data.recentEvents[0].topic : 'persistent://public/default/domain-events'}</span>
            </div>

            {data.recentEvents.length === 0 ? (
              <div className="bg-white/[0.03] backdrop-blur-sm border border-white/5 rounded-2xl p-12 text-center">
                <p className="text-zinc-500 mb-2">No events yet</p>
                <p className="text-xs text-zinc-600">Run the seed script: <code className="bg-white/5 px-1.5 py-0.5 rounded">npx ts-node scripts/seed.ts</code></p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.recentEvents.slice().reverse().map((event, i) => (
                  <div key={i} className="bg-white/[0.03] backdrop-blur-sm border border-white/5 rounded-xl px-5 py-4 flex items-center gap-4 hover:border-indigo-500/20 hover:bg-white/[0.05] transition-all duration-300">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${eventStatusColors[event.status] || 'bg-zinc-500/20 text-zinc-400'}`}>
                      {event.status}
                    </span>
                    <span className="text-sm text-white font-mono font-medium">{event.eventType}</span>
                    <span className="text-xs text-zinc-500 font-mono bg-white/5 px-2 py-0.5 rounded">{event.aggregateId}</span>
                    {event.traceId && (
                      <span className="text-[10px] text-indigo-400/60 font-mono bg-indigo-500/10 px-2 py-0.5 rounded" title="Trace ID">
                        {event.traceId}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-zinc-600 font-mono">{new Date(event.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Temporal Workflows Tab ───────────────────────── */}
        {activeTab === 'workflow' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Temporal Workflow Executions</h2>
              <span className="text-xs text-zinc-500 bg-white/5 px-3 py-1.5 rounded-full">Saga Pattern • Activity Retry • Compensation</span>
            </div>

            {mockWorkflows.map((wf) => (
              <div key={wf.workflowId} className="bg-white/[0.03] backdrop-blur-sm border border-white/5 rounded-2xl p-6 hover:border-indigo-500/20 transition-all duration-300">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${workflowStatusColors[wf.status] || 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'}`}>
                        {wf.status}
                      </span>
                      <span className="text-sm text-white font-mono font-semibold">{wf.workflowType}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-2.5 text-xs text-zinc-500">
                      <span className="font-mono bg-white/5 px-2 py-0.5 rounded">{wf.workflowId}</span>
                      {wf.runId && <span className="font-mono">Run: {wf.runId}</span>}
                      {wf.traceId && (
                        <span className="font-mono bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded">{wf.traceId}</span>
                      )}
                    </div>
                  </div>
                  {wf.startTime && (
                    <div className="text-right text-xs text-zinc-500 font-mono">
                      <div>Started: {new Date(wf.startTime).toLocaleTimeString()}</div>
                      {wf.closeTime && <div className="mt-0.5">Closed: {new Date(wf.closeTime).toLocaleTimeString()}</div>}
                    </div>
                  )}
                </div>

                {/* Activity chain visualization */}
                <div className="mt-4">
                  <div className="text-xs text-zinc-500 mb-3 uppercase tracking-wider font-medium">Activities</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {wf.activities.map((act, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className={`px-3.5 py-2.5 rounded-xl border text-xs ${
                          act.status === 'COMPLETED' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                          act.status === 'RUNNING' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                          act.status === 'FAILED' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                          'bg-zinc-500/10 border-zinc-500/30 text-zinc-400'
                        }`}>
                          <div className="font-mono font-medium">{act.name}</div>
                          <div className="text-[10px] mt-0.5 opacity-70">{act.duration}</div>
                        </div>
                        {i < wf.activities.length - 1 && (
                          <span className="text-zinc-600">→</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Code Guide Tab ───────────────────────────────── */}
        {activeTab === 'code' && (
          <div className="space-y-6">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Architecture Deep Dive</h2>

            {[
              {
                title: '1. Domain Layer (domain/)',
                subtitle: 'Pure business logic, zero external dependencies',
                files: ['domain/shared/aggregate-root.ts', 'domain/shared/value-object.ts', 'domain/shared/domain-event.ts', 'domain/order/order.aggregate.ts'],
                description: 'The Domain layer defines the core business rules. AggregateRoot emits DomainEvents when state changes. ValueObjects enforce invariants. No imports from infrastructure — this is the "inner circle" of DDD.',
              },
              {
                title: '2. Application Layer (application/)',
                subtitle: 'Orchestrates use cases, never contains business logic',
                files: ['application/order/commands/create-order.use-case.ts', 'application/order/queries/get-order.query.ts'],
                description: 'Use Cases wire together Domain objects and Infrastructure ports. CreateOrderUseCase calls Order.create() (Domain), then publishes via EventBusPort (Infrastructure). The application layer decides the orchestration, not the implementation.',
              },
              {
                title: '3. Infrastructure Layer (infrastructure/)',
                subtitle: 'Real integrations — Pulsar, Temporal, Redis, PostgreSQL, MongoDB',
                files: ['infrastructure/event-bus/pulsar-event-bus.adapter.ts', 'infrastructure/temporal/temporal.adapter.ts', 'infrastructure/cache/redis-cache.adapter.ts', 'infrastructure/database/postgres/order.repository.ts'],
                description: 'Ports & Adapters (Hexagonal Architecture). The Domain defines EventBusPort (abstract class). Infrastructure provides PulsarEventBusAdapter (concrete). AppModule binds them. Switch Pulsar for Kafka? One adapter swap. Zero Domain changes.',
              },
              {
                title: '4. Presentation Layer (presentation/)',
                subtitle: 'Controllers, guards, interceptors, filters',
                files: ['presentation/controllers/order.controller.ts', 'presentation/controllers/dashboard.controller.ts', 'presentation/guards/jwt-auth.guard.ts', 'presentation/interceptors/logging.interceptor.ts'],
                description: 'Thin controllers that delegate to Application layer. JwtAuthGuard validates tokens. LoggingInterceptor traces every request. GlobalExceptionFilter catches all errors. The Presentation layer never touches the Database directly.',
              },
            ].map((section, i) => (
              <div key={i} className="bg-white/[0.03] border border-white/5 rounded-xl p-6">
                <h3 className="font-semibold text-white mb-1">{section.title}</h3>
                <p className="text-xs text-indigo-400 mb-3">{section.subtitle}</p>
                <p className="text-sm text-zinc-400 mb-4 leading-relaxed">{section.description}</p>
                <div className="space-y-1">
                  {section.files.map(f => (
                    <div key={f} className="flex items-center gap-2 text-xs">
                      <span className="text-zinc-600">📄</span>
                      <code className="text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded font-mono">{f}</code>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

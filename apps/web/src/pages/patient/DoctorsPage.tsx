import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Stethoscope, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../components/layout/AppLayout';
import { IconBadge } from '../../components/ui/IconBadge';
import { api } from '../../lib/api';
import { motion } from 'framer-motion';

export default function DoctorsPage() {
  const [search, setSearch] = useState('');
  const { data: doctors = [], isLoading } = useQuery({
    queryKey: ['doctors', search],
    queryFn: () => api.get('/doctors', { params: search ? { specialization: search } : {} }).then(r => r.data),
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Find a Doctor</h1>
          <p className="text-slate-500 text-sm mt-1">Search by specialization and book an appointment</p>
        </div>
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by specialization (e.g. Cardiology)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-white/60 bg-white/70 backdrop-blur-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-card"
          />
        </div>
        {isLoading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="glass-card p-5 animate-pulse h-20" />)}</div>
        ) : (
          <div className="space-y-3">
            {doctors.map((doc: any, i: number) => (
              <motion.div key={doc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link to={`/doctors/${doc.userId}/book`} className="glass-card p-5 flex items-center gap-4 hover:shadow-card-hover transition-all block">
                  <IconBadge icon={Stethoscope} tone="primary" size="lg" />
                  <div className="flex-1">
                    <p className="font-bold text-slate-800">Dr. {doc.user?.name}</p>
                    <p className="text-primary-600 text-sm font-medium">{doc.specialization}</p>
                    {doc.bio && <p className="text-slate-400 text-xs mt-1 line-clamp-1">{doc.bio}</p>}
                  </div>
                  <ChevronRight size={18} className="text-slate-300" />
                </Link>
              </motion.div>
            ))}
            {doctors.length === 0 && (
              <div className="glass-card p-8 text-center text-slate-500">No doctors found. Try a different specialization.</div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

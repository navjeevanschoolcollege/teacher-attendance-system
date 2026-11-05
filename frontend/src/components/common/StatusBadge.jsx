import React from 'react';

const statusConfig = {
  present: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500', label: 'Present' },
  late: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Late' },
  absent: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500', label: 'Absent' },
  half_day: { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500', label: 'Half Day' },
  on_leave: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500', label: 'On Leave' },
  holiday: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500', label: 'Holiday' },
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500', label: 'Pending' },
  approved: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500', label: 'Approved' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500', label: 'Rejected' },
};

function StatusBadge({ status, className = '' }) {
  const normalizedStatus = (status || 'absent').toLowerCase().replace(/\s+/g, '_');
  const config = statusConfig[normalizedStatus] || statusConfig.absent;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

export default StatusBadge;

import React, { useState } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import LiveClock from '../components/common/LiveClock';
import {
  LayoutDashboard,
  CalendarCheck,
  CalendarDays,
  User,
  LogOut,
  Menu,
  X,
  Wifi,
  GraduationCap
} from 'lucide-react';

import TeacherDashboard from '../components/teacher/TeacherDashboard';
import MyAttendance from '../components/teacher/MyAttendance';
import ApplyLeave from '../components/teacher/ApplyLeave';
import MyProfile from '../components/teacher/MyProfile';

export default function TeacherLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { teacherProfile, user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'My Status & Check-In', path: '/teacher', icon: LayoutDashboard, exact: true },
    { label: 'My Attendance Calendar', path: '/teacher/attendance', icon: CalendarCheck },
    { label: 'Apply Leave', path: '/teacher/leave', icon: CalendarDays },
    { label: 'My Profile & Device', path: '/teacher/profile', icon: User },
  ];

  const isActive = (item) => {
    if (item.exact) return location.pathname === '/teacher' || location.pathname === '/teacher/';
    return location.pathname.startsWith(item.path);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-md">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-sm leading-tight text-white">Campus Portal</h2>
              <span className="text-[11px] font-medium text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60">
                Teacher App
              </span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Card */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center justify-between">
            <div className="truncate mr-2">
              <p className="text-xs font-semibold text-white truncate">
                {teacherProfile?.full_name || 'Faculty Member'}
              </p>
              <p className="text-[11px] text-emerald-400 truncate">ID: {teacherProfile?.teacher_id || '-'}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-700 font-semibold rounded-full border border-emerald-200">
                {teacherProfile?.department || 'Faculty'}
              </span>
              <span className="text-xs text-slate-500 font-medium">{teacherProfile?.full_name}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <LiveClock />
            <button
              onClick={handleLogout}
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-rose-200 hover:bg-rose-50 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto">
          <Routes>
            <Route index element={<TeacherDashboard />} />
            <Route path="attendance" element={<MyAttendance />} />
            <Route path="leave" element={<ApplyLeave />} />
            <Route path="profile" element={<MyProfile />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

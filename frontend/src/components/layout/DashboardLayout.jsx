import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Newspaper, CalendarDays, BookOpen, CalendarClock, FileText,
  Radio, Handshake, Users, GraduationCap, LogOut, Menu, X, ClipboardList,
  Gavel, CalendarCheck, School, BarChart3, MonitorPlay, Download, Library,
} from "lucide-react";
import { useAuth, roleLabel } from "@/context/AuthContext";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const NAV = {
  admin: [
    { to: "/admin", label: "Ringkasan", icon: LayoutDashboard, end: true },
    { to: "/admin/news", label: "Berita & Pengumuman", icon: Newspaper },
    { to: "/admin/calendar", label: "Kalender Akademik", icon: CalendarDays },
    { to: "/admin/courses", label: "Kursus", icon: BookOpen },
    { to: "/admin/schedule", label: "Jadwal & Bidding", icon: CalendarClock },
    { to: "/admin/tryouts", label: "Bank Soal & Try Out", icon: FileText },
    { to: "/admin/broadcasts", label: "Broadcast Proktor", icon: Radio },
    { to: "/admin/partnerships", label: "Kemitraan", icon: Handshake },
    { to: "/admin/users", label: "Pengguna & Sekolah", icon: Users },
  ],
  student: [
    { to: "/student", label: "Ringkasan", icon: LayoutDashboard, end: true },
    { to: "/student/learning", label: "Ruang Belajar", icon: Library },
    { to: "/student/tryouts", label: "CBT / Try Out", icon: ClipboardList },
    { to: "/student/courses", label: "Katalog Kursus", icon: BookOpen },
    { to: "/student/schedule", label: "Jadwal Saya", icon: CalendarCheck },
  ],
  tutor: [
    { to: "/tutor", label: "Ringkasan", icon: LayoutDashboard, end: true },
    { to: "/tutor/bidding", label: "Job Bidding", icon: Gavel },
    { to: "/tutor/calendar", label: "Kalender Saya", icon: CalendarCheck },
    { to: "/tutor/classes", label: "Manajemen Kelas", icon: Users },
    { to: "/tutor/materials", label: "Materi Ajar", icon: Library },
  ],
  proctor: [
    { to: "/proctor", label: "Ringkasan", icon: LayoutDashboard, end: true },
    { to: "/proctor/monitoring", label: "Live Monitoring", icon: MonitorPlay },
    { to: "/proctor/analytics", label: "Analitik Performa", icon: BarChart3 },
    { to: "/proctor/reports", label: "Laporan Nilai", icon: Download },
  ],
};

function SidebarContent({ items, onNavigate }) {
  return (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          data-testid={`nav-${item.to.replace(/\//g, "-").replace(/^-/, "")}`}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
              isActive
                ? "bg-[#4361EE] text-white shadow-sm shadow-[#4361EE]/30"
                : "text-[#475569] hover:bg-[#EEF2FF] hover:text-[#4361EE]"
            }`
          }
        >
          <item.icon className="h-[18px] w-[18px] shrink-0" />
          <span className="truncate">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-5 h-16 border-b border-[#E2E8F0]">
      <div className="h-9 w-9 rounded-xl bg-[#4361EE] flex items-center justify-center shadow-md shadow-[#4361EE]/30">
        <GraduationCap className="h-5 w-5 text-white" />
      </div>
      <div className="leading-tight">
        <p className="font-head font-bold text-[#0A1128] text-[15px]">CendekiaLMS</p>
        <p className="text-[10px] uppercase tracking-widest text-[#94A3B8]">Learning System</p>
      </div>
    </div>
  );
}

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = NAV[user?.role] || [];

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const initials = (user?.name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#F4F7FE] flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-[#E2E8F0] flex-col fixed inset-y-0 z-30">
        <Brand />
        <SidebarContent items={items} />
        <div className="p-3 border-t border-[#E2E8F0]">
          <button
            onClick={handleLogout}
            data-testid="logout-button"
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#475569] hover:bg-red-50 hover:text-red-600 transition-colors duration-200"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Keluar
          </button>
        </div>
      </aside>

      <div className="flex-1 lg:pl-64 min-w-0">
        {/* Top header */}
        <header className="h-16 bg-white border-b border-[#E2E8F0] flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button className="lg:hidden p-2 rounded-lg hover:bg-[#EEF2FF] text-[#475569]" data-testid="mobile-menu-button">
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72 flex flex-col">
                <Brand />
                <SidebarContent items={items} onNavigate={() => setMobileOpen(false)} />
                <div className="p-3 border-t border-[#E2E8F0]">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#475569] hover:bg-red-50 hover:text-red-600"
                  >
                    <LogOut className="h-[18px] w-[18px]" /> Keluar
                  </button>
                </div>
              </SheetContent>
            </Sheet>
            <div>
              <p className="text-xs text-[#94A3B8] font-medium">Portal {roleLabel(user?.role)}</p>
              <p className="text-sm font-semibold text-[#0A1128] hidden sm:block">Selamat datang, {user?.name?.split(" ")[0]}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-[#0A1128] leading-tight">{user?.name}</p>
              <p className="text-xs text-[#94A3B8]">{user?.email}</p>
            </div>
            {user?.picture ? (
              <img src={user.picture} alt="avatar" className="h-9 w-9 rounded-full object-cover border border-[#E2E8F0]" />
            ) : (
              <div className="h-9 w-9 rounded-full bg-[#EEF2FF] text-[#4361EE] flex items-center justify-center text-sm font-bold">
                {initials}
              </div>
            )}
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 max-w-[1400px]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

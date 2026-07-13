import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, limit, where, Timestamp, updateDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { 
  Bell, 
  Users, 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Store,
  ArrowUpRight,
  History,
  Sparkles,
  User as UserIcon,
  Trash2,
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
  DollarSign,
  Calendar,
  ShieldCheck
} from 'lucide-react';
import { format, isAfter, isBefore, addDays, startOfDay, startOfMonth, startOfYear, subMonths, eachMonthOfInterval, isSameDay, isSameMonth, isSameYear } from 'date-fns';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';

interface Reminder {
  id: string;
  customerId: string;
  customerName: string;
  reminderTime: Timestamp;
  message: string;
  status: 'pending' | 'completed';
}

interface Invoice {
  id: string;
  totalAmount: number;
  date: Timestamp;
  status: string;
}

export function Dashboard({ onNavigate }: { onNavigate?: (tab: 'dashboard' | 'customers' | 'invoices' | 'history' | 'settings') => void } = {}) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [salesFilter, setSalesFilter] = useState<'today' | 'month' | 'year' | 'total'>('month');
  const [bkashNumber, setBkashNumber] = useState('01841546004');
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalInvoices: 0,
    pendingReminders: 0,
    totalRevenue: 0,
    filteredRevenue: 0
  });

  useEffect(() => {
    // Fetch App Settings
    const fetchSettings = async () => {
      try {
        const settingsSnap = await getDoc(doc(db, 'settings', 'app'));
        if (settingsSnap.exists()) {
          setBkashNumber(settingsSnap.data().bkashNumber || '01841546004');
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
      }
    };
    fetchSettings();
    // Fetch Reminders
    const remindersQuery = query(
      collection(db, 'reminders'),
      where('status', '==', 'pending'),
      orderBy('reminderTime', 'asc'),
      limit(10)
    );

    const unsubscribeReminders = onSnapshot(remindersQuery, (snapshot) => {
      const reminderData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Reminder[];
      setReminders(reminderData);
      setStats(prev => ({ ...prev, pendingReminders: reminderData.length }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'reminders');
    });

    // Fetch Stats
    const unsubscribeCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setStats(prev => ({ ...prev, totalCustomers: snapshot.size }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'customers');
    });

    const unsubscribeInvoices = onSnapshot(collection(db, 'invoices'), (snapshot) => {
      const invoiceData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Invoice[];
      
      setInvoices(invoiceData);
      
      const totalRev = invoiceData.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
      setStats(prev => ({ 
        ...prev, 
        totalInvoices: snapshot.size,
        totalRevenue: totalRev
      }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'invoices');
    });

    return () => {
      unsubscribeReminders();
      unsubscribeCustomers();
      unsubscribeInvoices();
    };
  }, []);

  // Calculate Filtered Revenue
  useEffect(() => {
    const now = new Date();
    let filtered = 0;

    invoices.forEach(inv => {
      if (!inv.date) return;
      const date = inv.date.toDate();
      if (salesFilter === 'today' && isSameDay(date, now)) {
        filtered += inv.totalAmount || 0;
      } else if (salesFilter === 'month' && isSameMonth(date, now)) {
        filtered += inv.totalAmount || 0;
      } else if (salesFilter === 'year' && isSameYear(date, now)) {
        filtered += inv.totalAmount || 0;
      } else if (salesFilter === 'total') {
        filtered += inv.totalAmount || 0;
      }
    });

    setStats(prev => ({ ...prev, filteredRevenue: filtered }));
  }, [invoices, salesFilter]);

  // Prepare Chart Data
  const chartData = useMemo(() => {
    const now = new Date();
    const last6Months = eachMonthOfInterval({
      start: subMonths(now, 5),
      end: now
    });

    return last6Months.map(month => {
      const monthStr = format(month, 'MMM');
      const monthRevenue = invoices
        .filter(inv => {
          if (!inv.date) return false;
          const date = inv.date.toDate();
          return date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
        })
        .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

      return {
        name: monthStr,
        revenue: monthRevenue
      };
    });
  }, [invoices]);

  const completeReminder = async (id: string) => {
    try {
      await updateDoc(doc(db, 'reminders', id), {
        status: 'completed'
      });
      toast.success("Reminder marked as completed");
    } catch (error) {
      console.error("Error completing reminder:", error);
      toast.error("Failed to update reminder");
    }
  };

  const deleteReminder = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'reminders', id));
      toast.success("Reminder deleted successfully");
    } catch (error) {
      console.error("Error deleting reminder:", error);
      toast.error("Failed to delete reminder");
    }
  };

  const getReminderStatus = (time: Timestamp) => {
    const date = time.toDate();
    const now = new Date();
    if (isBefore(date, now)) return { label: 'Overdue', color: 'bg-destructive/10 text-destructive border-destructive/20' };
    if (isBefore(date, addDays(now, 1))) return { label: 'Due Soon', color: 'bg-primary/10 text-primary border-primary/20' };
    return { label: 'Upcoming', color: 'bg-muted text-muted-foreground border-border' };
  };

  const StatCard = ({ title, value, icon: Icon, subtext, trend, className, onClick }: any) => (
    <Card 
      onClick={onClick}
      className={cn(
        "border border-border shadow-sm bg-card overflow-hidden group hover:shadow-md transition-all duration-300 h-full rounded-xl select-none", 
        onClick ? "cursor-pointer hover:border-primary/30 active:scale-[0.98]" : "",
        className
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-1 p-4">
        <CardTitle className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{title}</CardTitle>
        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
          <Icon className="h-3.5 w-3.5" />
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="text-xl md:text-2xl font-sans font-bold text-primary tracking-tight">{value}</div>
        <div className="flex items-center gap-2 mt-1">
          {trend && (
            <div className="flex items-center text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full border border-primary/20">
              <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />
              {trend}
            </div>
          )}
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{subtext}</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary mb-1">
            <Sparkles className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Merchant Dashboard</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-sans font-bold text-primary tracking-tight">Iconshopbd</h2>
          <p className="text-xs text-muted-foreground">Business Overview & Intelligence Portal.</p>
        </div>
        <div className="flex items-center gap-2 bg-card p-1.5 rounded-xl shadow-md border border-border">
          <div className="px-3 py-1 border-r border-border">
            <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-tighter">System Status</p>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-bold text-primary">Live</span>
            </div>
          </div>
          <div className="px-3 py-1">
            <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-tighter">Issue Date</p>
            <p className="text-xs font-bold text-primary">{format(new Date(), 'MMM dd, yyyy')}</p>
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard 
          title="Total Clients" 
          value={stats.totalCustomers} 
          icon={Users} 
          subtext="Lifetime database"
          trend="+12%"
          onClick={() => onNavigate?.('customers')}
        />
        <StatCard 
          title="Total Invoices" 
          value={stats.totalInvoices} 
          icon={FileText} 
          subtext="Orders processed"
          trend="+5%"
          onClick={() => onNavigate?.('history')}
        />
        <Card 
          onClick={() => onNavigate?.('history')}
          className="border border-border shadow-md bg-primary text-primary-foreground overflow-hidden group transition-all duration-300 relative h-full rounded-2xl cursor-pointer hover:shadow-lg active:scale-[0.98]"
        >
          <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <DollarSign className="h-20 w-20" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-1 p-4 relative z-10">
            <CardTitle className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary-foreground/60">Revenue</CardTitle>
            <div onClick={e => e.stopPropagation()}>
              <Select value={salesFilter} onValueChange={(v: any) => setSalesFilter(v)}>
                <SelectTrigger className="w-[90px] h-7 bg-black/20 border-none text-[9px] font-bold uppercase tracking-widest rounded-lg backdrop-blur-sm focus:ring-0">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="year">Year</SelectItem>
                  <SelectItem value="total">Total</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 relative z-10">
            <div className="text-xl md:text-2xl font-sans font-bold tracking-tight">{stats.filteredRevenue.toLocaleString()} BDT</div>
            <div className="flex items-center gap-2 mt-1">
              <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse" />
              <p className="text-[9px] font-bold uppercase tracking-widest text-primary-foreground/60">
                {salesFilter === 'total' ? 'Lifetime' : `${salesFilter}`}
              </p>
            </div>
          </CardContent>
        </Card>
        <StatCard 
          title="Reminders" 
          value={stats.pendingReminders} 
          icon={Bell} 
          subtext="Pending follow-ups"
          onClick={() => onNavigate?.('customers')}
        />
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border border-border shadow-xl bg-card overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl font-sans font-bold text-primary">Sales Performance</CardTitle>
              <CardDescription>Monthly revenue trends for the last 6 months.</CardDescription>
            </div>
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center text-primary">
              <BarChart3 className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="h-[300px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#a8a29e', fontSize: 12 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#a8a29e', fontSize: 12 }}
                  tickFormatter={(value) => `${value / 1000}k`}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: '1px solid var(--color-border)', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '12px'
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="var(--color-primary)" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorRev)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-xl bg-card overflow-hidden">
          <CardHeader>
            <CardTitle className="text-xl font-sans font-bold text-primary">Revenue Share</CardTitle>
            <CardDescription>Lifetime vs Filtered</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Filtered', value: stats.filteredRevenue },
                    { name: 'Other', value: Math.max(0, stats.totalRevenue - stats.filteredRevenue) }
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill="var(--color-primary)" />
                  <Cell fill="var(--color-muted-foreground)" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-primary" />
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Selected</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-muted-foreground" />
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Balance</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Reminders Section */}
        <Card className="lg:col-span-2 border border-border shadow-xl bg-card overflow-hidden">
          <CardHeader className="bg-muted border-b border-border p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-xl font-sans font-bold text-primary">Active Follow-ups</CardTitle>
                  <CardDescription>Critical customer reminders and knock times.</CardDescription>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onNavigate?.('customers')}
                className="text-primary hover:bg-primary/5 hover:text-primary font-bold uppercase tracking-widest text-[10px]"
              >
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {reminders.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                  <CheckCircle2 className="h-16 w-16 mx-auto mb-4 opacity-10" />
                  <p className="font-sans italic text-lg">Your schedule is clear</p>
                  <p className="text-sm">All customer follow-ups are completed.</p>
                </div>
              ) : (
                reminders.map((reminder) => {
                  const status = getReminderStatus(reminder.reminderTime);
                  return (
                    <motion.div 
                      key={reminder.id} 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-between p-6 hover:bg-muted transition-colors group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <UserIcon className="h-5 w-5" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-primary text-lg">{reminder.customerName}</span>
                            <Badge variant="outline" className={cn("text-[10px] font-bold uppercase tracking-tighter px-2 py-0", status.color)}>
                              {status.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{reminder.message}</p>
                          <div className="flex items-center gap-4 pt-1">
                            <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                              <Calendar className="h-3 w-3" />
                              {format(reminder.reminderTime.toDate(), 'PPP')}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                              <Clock className="h-3 w-3" />
                              {format(reminder.reminderTime.toDate(), 'p')}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => completeReminder(reminder.id)}
                          className="h-12 w-12 rounded-full text-muted-foreground hover:text-green-600 hover:bg-green-50 transition-all"
                        >
                          <CheckCircle2 className="h-6 w-6" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => deleteReminder(reminder.id)}
                          className="h-12 w-12 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                        >
                          <Trash2 className="h-6 w-6" />
                        </Button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border border-border shadow-2xl bg-card overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Store className="h-40 w-40" />
            </div>
            <CardHeader className="relative z-10">
              <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center mb-4">
                <ShieldCheck className="h-6 w-6 text-primary-foreground" />
              </div>
              <CardTitle className="text-2xl font-sans text-primary">Business Profile</CardTitle>
              <CardDescription className="text-muted-foreground">Verified Merchant Portal</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 relative z-10">
              <div className="space-y-6">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Trading Name</p>
                  <p className="text-xl font-sans font-bold">Iconshopbd</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Headquarters</p>
                  <p className="text-sm text-muted-foreground">Dhaka, Bangladesh</p>
                </div>
                <div className="pt-6 border-t border-border">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-3">Primary Payment Gateway</p>
                  <div className="bg-[#E2136E]/5 p-6 rounded-3xl border border-[#E2136E]/20 flex items-center justify-between group/bkash transition-all hover:bg-[#E2136E]/10">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-[#E2136E]">bKash Merchant</p>
                        <div className="h-4 w-4 bg-[#E2136E] rounded-full flex items-center justify-center">
                          <span className="text-[10px] text-white font-black italic">b</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Accepting Payments</p>
                    </div>
                    <p className="text-2xl font-sans font-black text-[#E2136E] tracking-tighter group-hover/bkash:scale-105 transition-transform">{bkashNumber}</p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-muted rounded-2xl border border-border">
                <p className="text-xs text-primary leading-relaxed font-medium italic">
                  "Perfecting digital store aesthetics, one icon at a time."
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border shadow-xl bg-card p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center text-primary">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-primary">Secure Access</p>
                <p className="text-xs text-muted-foreground">End-to-end encrypted database</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

import * as React from 'react';
import { useState, useEffect } from 'react';
import { db } from './firebase';
import { onSnapshot, doc } from 'firebase/firestore';
import { Toaster, toast } from 'sonner';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { CustomerManagement } from './components/CustomerManagement';
import { InvoiceGenerator } from './components/InvoiceGenerator';
import { Settings } from './components/Settings';
import { Button } from './components/ui/button';
import { cn } from './lib/utils';
import { BrandLogo } from './components/BrandLogo';
import { Card, CardContent } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Loader2, Lock, Key, Sparkles, ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'customers' | 'invoices' | 'history' | 'settings'>('dashboard');
  const [preSelectedCustomer, setPreSelectedCustomer] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [companyName, setCompanyName] = useState('Iconshopbd');
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => {
    // Check local authentication session
    const session = localStorage.getItem('iconshop_auth_session');
    if (session === 'true') {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }

    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'app'), (doc) => {
      if (doc.exists()) {
        setLogo(doc.data().companyLogo || null);
        setCompanyName(doc.data().companyName || 'Iconshopbd');
      }
    });

    setLoading(false);
    return () => unsubscribeSettings();
  }, []);

  const handlePasswordLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password === 'if123' || password === 'isbd123' || password === 'icon123' || password === 'rogg123') {
      setIsAuthenticated(true);
      localStorage.setItem('iconshop_auth_session', 'true');
      toast.success("Welcome back to Iconshopbd Management");
    } else {
      toast.error("Invalid password. Please try again.");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('iconshop_auth_session');
    setPassword('');
    toast.info("Signed out successfully.");
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className={cn(
            "h-16 w-16 rounded-2xl flex items-center justify-center animate-pulse shadow-2xl overflow-hidden p-1.5",
            logo ? "bg-white border border-primary/10" : "bg-primary"
          )}>
            {logo ? (
              <img src={logo} alt="Logo" className="h-full w-full object-contain overflow-hidden rounded-xl" />
            ) : (
              <BrandLogo size="lg" />
            )}
          </div>
          <p className="text-primary font-sans font-bold tracking-widest uppercase text-xs animate-pulse">Initializing Portal...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-primary/20 blur-[150px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-primary/20 blur-[150px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg z-10"
        >
          <Card className="border border-primary/20 shadow-2xl bg-card/80 backdrop-blur-xl overflow-hidden rounded-[2.5rem]">
            <div className="bg-primary p-12 text-center relative overflow-hidden">
              <div className="absolute top-4 right-4 text-primary-foreground/10">
                <Sparkles className="h-24 w-24 -rotate-12 animate-pulse" />
              </div>
              <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-white text-primary shadow-2xl overflow-hidden p-2 border border-primary/10">
                {logo ? (
                  <img src={logo} alt="Logo" className="h-full w-full object-contain overflow-hidden rounded-xl" />
                ) : (
                  <BrandLogo size="xl" />
                )}
              </div>
              <h1 className="text-4xl font-heading font-bold text-primary-foreground mb-3">{companyName}</h1>
              <p className="text-primary-foreground/70 text-[10px] uppercase tracking-[0.4em] font-bold">Secure Management Access</p>
            </div>

            <CardContent className="p-12">
              <form onSubmit={handlePasswordLogin} className="space-y-8">
                <div className="space-y-3">
                  <Label className="text-xs uppercase font-bold tracking-widest text-primary/60 ml-1">System Password</Label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-primary/40 group-focus-within:text-primary transition-colors">
                      <Lock className="h-6 w-6" />
                    </div>
                    <Input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="Enter access code (e.g. if123)" 
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="h-16 pl-14 pr-14 border-primary/10 bg-muted/30 rounded-2xl text-lg font-medium focus:border-primary/40 focus:ring-primary/5 transition-all"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-primary/20 hover:text-primary transition-colors"
                    >
                      {showPassword ? <Key className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
                    </button>
                  </div>
                </div>
                
                <Button 
                  type="submit"
                  className="w-full h-16 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-[0.98]"
                >
                  Unlock System
                </Button>

                <p className="text-center text-[10px] text-muted-foreground uppercase tracking-widest leading-relaxed">
                  Confidential access restricted to authorized personnel only. 
                  <br />Unauthorized entry attempts are monitored.
                </p>
              </form>
            </CardContent>
            
            <div className="bg-primary/5 p-6 text-center border-t border-primary/10">
              <p className="text-[10px] text-primary/40 uppercase tracking-[0.3em] font-bold italic">
                {companyName} • Professional Excellence
              </p>
            </div>
          </Card>
        </motion.div>
        <Toaster position="top-center" richColors />
      </div>
    );
  }

  const handleMakeInvoice = (customer: any) => {
    setPreSelectedCustomer(customer);
    setActiveTab('invoices');
  };

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      onLogout={handleLogout} 
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="w-full"
        >
          {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab} />}
          {activeTab === 'customers' && <CustomerManagement onMakeInvoice={handleMakeInvoice} />}
          {activeTab === 'invoices' && (
            <InvoiceGenerator 
              initialView="create" 
              preSelectedCustomer={preSelectedCustomer}
              onClearPreSelected={() => setPreSelectedCustomer(null)}
            />
          )}
          {activeTab === 'history' && <InvoiceGenerator initialView="history" />}
          {activeTab === 'settings' && <Settings />}
        </motion.div>
      </AnimatePresence>
      <Toaster position="top-center" richColors />
    </Layout>
  );
}

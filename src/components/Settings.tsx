import * as React from 'react';
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { 
  Settings as SettingsIcon, 
  Save, 
  Store, 
  CreditCard, 
  Hash, 
  Folder,
  Loader2,
  ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';

export interface AppSettings {
  companyName: string;
  companyAddress: string;
  bkashNumber: string;
  paymentInstructions: string;
  paymentNote: string;
  invoicePrefix: string;
  vipFolderPrefix: string;
  companyLogo?: string;
  bkashLogo?: string;
}

export function Settings() {
  const [settings, setSettings] = useState<AppSettings>({
    companyName: 'Iconshopbd',
    companyAddress: 'Dhaka, Bangladesh',
    bkashNumber: '01841546004',
    paymentInstructions: "Please use 'Make Payment' option in your bKash app.",
    paymentNote: 'Thank you!',
    invoicePrefix: 'IF',
    vipFolderPrefix: 'I',
    companyLogo: '',
    bkashLogo: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'general'>('general');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'app');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data() as AppSettings);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'company' | 'bkash') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) { // 500KB limit for base64
        toast.error("Logo file too large. Please use a file under 500KB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'company') {
          setSettings({ ...settings, companyLogo: reader.result as string });
        } else {
          setSettings({ ...settings, bkashLogo: reader.result as string });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'app'), settings);
      toast.success("Settings updated successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <header className="border-b border-border pb-6">
        <div className="flex items-center gap-2 text-primary mb-2">
          <SettingsIcon className="h-5 w-5" />
          <span className="text-sm font-bold uppercase tracking-widest">System Configuration</span>
        </div>
        <h2 className="text-4xl font-sans font-bold text-primary">Portal Settings</h2>
        <p className="text-muted-foreground mt-1">Configure your business details and invoice preferences.</p>
      </header>

      <div className="flex items-center gap-4 mb-8 bg-muted p-1 rounded-2xl w-fit">
        <Button 
          variant="default"
          className="rounded-xl font-bold text-xs uppercase tracking-widest px-6 h-10 bg-primary text-primary-foreground"
        >
          <Store className="mr-2 h-4 w-4" />
          General
        </Button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border border-border shadow-xl bg-card">
              <CardHeader className="border-b border-border">
                <div className="flex items-center gap-2 text-primary">
                  <Store className="h-5 w-5" />
                  <CardTitle className="text-lg font-sans font-bold">Business Identity</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Company Logo</Label>
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-20 rounded-xl bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
                      {settings.companyLogo ? (
                        <img src={settings.companyLogo} alt="Logo" className="h-full w-full object-contain" />
                      ) : (
                        <Store className="h-8 w-8 text-muted-foreground/30" />
                      )}
                    </div>
                    <div className="flex-1">
                      <Input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleLogoUpload(e, 'company')}
                        className="h-10 text-xs border-border"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">Recommended: Square PNG/JPG, max 500KB</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Company Name</Label>
                  <Input 
                    value={settings.companyName}
                    onChange={e => setSettings({...settings, companyName: e.target.value})}
                    className="h-12 border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Address</Label>
                  <Input 
                    value={settings.companyAddress}
                    onChange={e => setSettings({...settings, companyAddress: e.target.value})}
                    className="h-12 border-border"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-xl bg-card">
              <CardHeader className="border-b border-border">
                <div className="flex items-center gap-2 text-primary">
                  <CreditCard className="h-5 w-5" />
                  <CardTitle className="text-lg font-sans font-bold">Payment Details</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">bKash Logo</Label>
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-20 rounded-xl bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
                      {settings.bkashLogo ? (
                        <img src={settings.bkashLogo} alt="bKash Logo" className="h-full w-full object-contain" />
                      ) : (
                        <div className="text-primary font-black text-2xl">b</div>
                      )}
                    </div>
                    <div className="flex-1">
                      <Input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleLogoUpload(e, 'bkash')}
                        className="h-10 text-xs border-border"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">Recommended: Square PNG/JPG, max 500KB</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">bKash Merchant Number</Label>
                  <Input 
                    value={settings.bkashNumber}
                    onChange={e => setSettings({...settings, bkashNumber: e.target.value})}
                    className="h-12 border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Payment Instructions</Label>
                  <Input 
                    value={settings.paymentInstructions}
                    onChange={e => setSettings({...settings, paymentInstructions: e.target.value})}
                    className="h-12 border-border"
                    placeholder="e.g. Use 'Make Payment'..."
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Payment Note (Bottom Left)</Label>
                  <Input 
                    value={settings.paymentNote}
                    onChange={e => setSettings({...settings, paymentNote: e.target.value})}
                    className="h-12 border-border"
                    placeholder="e.g. Thank you!"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-xl bg-card">
              <CardHeader className="border-b border-border">
                <div className="flex items-center gap-2 text-primary">
                  <Hash className="h-5 w-5" />
                  <CardTitle className="text-lg font-sans font-bold">Invoice Numbering</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Invoice Prefix</Label>
                  <Input 
                    value={settings.invoicePrefix}
                    onChange={e => setSettings({...settings, invoicePrefix: e.target.value})}
                    className="h-12 border-border"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-xl bg-card">
              <CardHeader className="border-b border-border">
                <div className="flex items-center gap-2 text-primary">
                  <Folder className="h-5 w-5" />
                  <CardTitle className="text-lg font-sans font-bold">VIP Folders</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">VIP Folder Prefix</Label>
                  <Input 
                    value={settings.vipFolderPrefix}
                    onChange={e => setSettings({...settings, vipFolderPrefix: e.target.value})}
                    className="h-12 border-border"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={saving}
              className="h-14 px-12 bg-primary text-primary-foreground font-bold text-lg rounded-xl shadow-xl"
            >
              {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
              Save Changes
            </Button>
          </div>
        </form>
    </div>
  );
}

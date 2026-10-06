import * as React from 'react';
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  Timestamp, 
  doc, 
  updateDoc, 
  deleteDoc,
  where,
  getDoc
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { cn } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from './ui/dialog';
import { 
  Search, 
  Plus, 
  UserPlus, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Bell,
  Trash2,
  Edit2,
  Loader2,
  Users,
  Filter,
  MoreVertical,
  Crown,
  ArrowLeft,
  FileText,
  Save,
  Receipt
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { motion } from 'motion/react';

interface Customer {
  id: string;
  customerId: string;
  name: string;
  address: string;
  mobile: string;
  email: string;
  notes: string;
  type: 'VIP' | 'Regular';
  group?: string;
  createdAt: Timestamp;
}

interface CustomerManagementProps {
  onMakeInvoice?: (customer: any) => void;
}

export function CustomerManagement({ onMakeInvoice }: CustomerManagementProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'vip-groups'>('all');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [groupInvoices, setGroupInvoices] = useState<any[]>([]);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  useEffect(() => {
    if (selectedGroup) {
      const q = query(collection(db, 'invoices'), where('customerType', '==', 'VIP'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const invs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Filter by customers in this group
        const groupCustomerIds = customers.filter(c => c.group === selectedGroup).map(c => c.customerId);
        setGroupInvoices(invs.filter((inv: any) => groupCustomerIds.includes(inv.customerId)));
      });
      return () => unsubscribe();
    }
  }, [selectedGroup, customers]);
  const [formData, setFormData] = useState({
    customerId: '',
    name: '',
    address: '',
    mobile: '',
    email: '',
    notes: '',
    type: 'Regular' as 'VIP' | 'Regular',
    group: ''
  });

  useEffect(() => {
    const fetchPrefix = async () => {
      if (isAddModalOpen) {
        try {
          const settingsRef = doc(db, 'settings', 'app');
          const settingsSnap = await getDoc(settingsRef);
          const prefix = settingsSnap.exists() ? settingsSnap.data().invoicePrefix : 'IF';
          
          const nextId = customers.length > 0 
            ? Math.max(...customers.map(c => {
                const num = parseInt(c.customerId.split('-').pop() || '0');
                return isNaN(num) ? 0 : num;
              })) + 1 
            : 1;
          
          const isVIP = formData.type === 'VIP';
          const vipPrefix = settingsSnap.exists() ? settingsSnap.data().vipFolderPrefix : '';
          const finalPrefix = isVIP ? `${prefix}-VIP${vipPrefix ? '-' + vipPrefix : ''}` : prefix;
          setFormData(prev => ({ ...prev, customerId: `${finalPrefix}-${nextId.toString().padStart(5, '0')}` }));
        } catch (error) {
          console.error("Error fetching prefix:", error);
        }
      }
    };
    fetchPrefix();
  }, [isAddModalOpen, customers, formData.type]);

  const [reminderData, setReminderData] = useState({
    date: '',
    time: '',
    message: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'customers'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const customerData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];
      setCustomers(customerData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'customers');
    });
    return () => unsubscribe();
  }, []);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerId || !formData.name || !formData.mobile) {
      setShowValidationErrors(true);
      toast.error("Please fill in required fields (ID, Name, Mobile)");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'customers'), {
        ...formData,
        createdAt: Timestamp.now()
      });
      toast.success("Customer added successfully");
      setIsAddModalOpen(false);
      setShowValidationErrors(false);
      setFormData({ customerId: '', name: '', address: '', mobile: '', email: '', notes: '', type: 'Regular', group: '' });
    } catch (error) {
      console.error("Error adding customer:", error);
      toast.error("Failed to add customer");
    } finally {
      setLoading(false);
    }
  };

  const handleEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer || !formData.name || !formData.mobile) {
      setShowValidationErrors(true);
      toast.error("Please fill in required fields (Name, Mobile)");
      return;
    }

    setLoading(true);
    try {
      const customerRef = doc(db, 'customers', editingCustomer.id);
      await updateDoc(customerRef, {
        ...formData
      });
      toast.success("Customer updated successfully");
      setIsEditModalOpen(false);
      setEditingCustomer(null);
      setShowValidationErrors(false);
      setFormData({ customerId: '', name: '', address: '', mobile: '', email: '', notes: '', type: 'Regular', group: '' });
    } catch (error) {
      console.error("Error updating customer:", error);
      toast.error("Failed to update customer");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!customerToDelete) return;

    setLoading(true);
    try {
      await deleteDoc(doc(db, 'customers', customerToDelete));
      toast.success("Customer deleted successfully");
      setIsDeleteModalOpen(false);
      setCustomerToDelete(null);
    } catch (error) {
      console.error("Error deleting customer:", error);
      toast.error("Failed to delete customer");
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      customerId: customer.customerId,
      name: customer.name,
      address: customer.address,
      mobile: customer.mobile,
      email: customer.email,
      notes: customer.notes,
      type: customer.type,
      group: customer.group || ''
    });
    setIsEditModalOpen(true);
  };

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !reminderData.date || !reminderData.time || !reminderData.message) {
      toast.error("Please fill in all reminder fields");
      return;
    }

    setLoading(true);
    try {
      const reminderTime = new Date(`${reminderData.date}T${reminderData.time}`);
      await addDoc(collection(db, 'reminders'), {
        customerId: selectedCustomer.customerId,
        customerName: selectedCustomer.name,
        reminderTime: Timestamp.fromDate(reminderTime),
        message: reminderData.message,
        status: 'pending'
      });
      toast.success(`Reminder set for ${selectedCustomer.name}`);
      setIsReminderModalOpen(false);
      setReminderData({ date: '', time: '', message: '' });
    } catch (error) {
      console.error("Error adding reminder:", error);
      toast.error("Failed to set reminder");
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         c.customerId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         c.mobile.includes(searchQuery);
    
    if (viewMode === 'vip-groups') {
      if (selectedGroup) {
        return matchesSearch && c.type === 'VIP' && c.group === selectedGroup;
      }
      return false; // Groups list handles the other case
    }
    
    return matchesSearch;
  });

  const vipGroups = Array.from(new Set(customers.filter(c => c.type === 'VIP' && c.group).map(c => c.group)));

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-stone-200 pb-6">
        <div>
          <div className="flex items-center gap-2 text-secondary mb-2">
            <Users className="h-5 w-5" />
            <span className="text-sm font-bold uppercase tracking-widest">Client Management</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-primary">Customer Database</h2>
          <p className="text-stone-500 mt-0.5 text-sm">Manage your lifetime customer records and set reminders.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-stone-100 p-1 rounded-lg">
            <Button 
              variant={viewMode === 'all' ? 'default' : 'ghost'}
              onClick={() => {
                setViewMode('all');
                setSelectedGroup(null);
              }}
              className={cn("rounded-md h-9 px-4 text-xs", viewMode === 'all' ? "bg-primary text-secondary" : "text-stone-500")}
            >
              All Clients
            </Button>
            <Button 
              variant={viewMode === 'vip-groups' ? 'default' : 'ghost'}
              onClick={() => setViewMode('vip-groups')}
              className={cn("rounded-md h-9 px-4 text-xs", viewMode === 'vip-groups' ? "bg-secondary text-primary" : "text-stone-500")}
            >
              VIP Groups
            </Button>
          </div>

          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger render={
              <Button className="h-10 px-6 bg-primary hover:bg-primary/90 text-secondary font-bold rounded-lg shadow-lg shadow-primary/20 text-sm">
                <UserPlus className="mr-2 h-4 w-4" />
                New Client
              </Button>
            } />
            <DialogContent className="sm:max-w-[550px] border-none shadow-2xl p-0 overflow-hidden">
              <div className="bg-primary p-6 text-white flex items-center justify-between">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-serif text-secondary">New Client Entry</DialogTitle>
                </DialogHeader>
                <Button 
                  onClick={handleAddCustomer} 
                  disabled={loading}
                  size="sm"
                  className="bg-secondary text-primary font-bold hover:bg-secondary/90"
                >
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-2" />}
                  Save
                </Button>
              </div>
              <form onSubmit={handleAddCustomer} className="p-8 space-y-6 bg-white max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="customerId" className="text-xs font-bold uppercase tracking-widest text-stone-500">Customer ID (Auto) *</Label>
                    <Input 
                      id="customerId" 
                      placeholder="ICON-00001" 
                      value={formData.customerId}
                      onChange={e => setFormData({...formData, customerId: e.target.value})}
                      required
                      readOnly
                      className="h-12 border-stone-200 bg-muted font-sans font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type" className="text-xs font-bold uppercase tracking-widest text-stone-500">Customer Type</Label>
                    <div className="flex gap-2">
                      <Button 
                        type="button"
                        variant={formData.type === 'Regular' ? 'default' : 'outline'}
                        onClick={() => setFormData({...formData, type: 'Regular', group: ''})}
                        className={cn("flex-1 h-12 rounded-xl", formData.type === 'Regular' ? "bg-primary text-secondary" : "")}
                      >
                        Regular
                      </Button>
                      <Button 
                        type="button"
                        variant={formData.type === 'VIP' ? 'default' : 'outline'}
                        onClick={() => setFormData({...formData, type: 'VIP'})}
                        className={cn("flex-1 h-12 rounded-xl", formData.type === 'VIP' ? "bg-secondary text-primary border-secondary" : "")}
                      >
                        VIP
                      </Button>
                    </div>
                  </div>
                </div>

                {formData.type === 'VIP' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-2"
                  >
                    <Label htmlFor="group" className="text-xs font-bold uppercase tracking-widest text-stone-500">VIP Group Name (e.g. Robi)</Label>
                    <Input 
                      id="group" 
                      placeholder="Enter group name" 
                      value={formData.group}
                      onChange={e => setFormData({...formData, group: e.target.value})}
                      className="h-12 border-stone-200 focus:border-secondary focus:ring-secondary/20"
                    />
                  </motion.div>
                )}

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Full Name *</Label>
                    {showValidationErrors && !formData.name && (
                      <span className="text-[10px] text-destructive font-mono font-bold animate-pulse">Required field</span>
                    )}
                  </div>
                  <Input 
                    id="name" 
                    placeholder="Customer Name" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    required
                    className={cn(
                      "h-12 border-border focus:border-primary focus:ring-primary/20",
                      showValidationErrors && !formData.name && "border-destructive focus:border-destructive focus:ring-destructive/20 border-2 bg-destructive/5"
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="mobile" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Mobile Number *</Label>
                      {showValidationErrors && !formData.mobile && (
                        <span className="text-[10px] text-destructive font-mono font-bold animate-pulse">Required field</span>
                      )}
                    </div>
                    <Input 
                      id="mobile" 
                      placeholder="01XXXXXXXXX" 
                      value={formData.mobile}
                      onChange={e => setFormData({...formData, mobile: e.target.value})}
                      required
                      className={cn(
                        "h-12 border-border focus:border-primary focus:ring-primary/20",
                        showValidationErrors && !formData.mobile && "border-destructive focus:border-destructive focus:ring-destructive/20 border-2 bg-destructive/5"
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email Address</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="customer@example.com" 
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      className="h-12 border-border focus:border-primary focus:ring-primary/20"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Address</Label>
                  <Input 
                    id="address" 
                    placeholder="Customer's full address" 
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                    className="h-12 border-border focus:border-primary focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Notes</Label>
                  <Input 
                    id="notes" 
                    placeholder="Any specific preferences or info" 
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                    className="h-12 border-border focus:border-primary focus:ring-primary/20"
                  />
                </div>
                <DialogFooter className="pt-4">
                  <Button type="submit" disabled={loading} className="w-full h-14 bg-primary text-primary-foreground font-bold text-lg rounded-xl">
                    {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Plus className="mr-2 h-5 w-5" />}
                    Save to Database
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {viewMode === 'vip-groups' && !selectedGroup ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vipGroups.length === 0 ? (
            <div className="col-span-full py-24 text-center bg-card rounded-3xl border-2 border-dashed border-border">
              <Crown className="h-16 w-16 mx-auto text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground font-serif italic text-xl">No VIP groups created yet</p>
            </div>
          ) : (
            vipGroups.map(group => (
              <motion.div
                key={group}
                whileHover={{ y: -5 }}
                className="cursor-pointer"
                onClick={() => setSelectedGroup(group)}
              >
                <Card className="border border-border shadow-xl hover:shadow-2xl transition-all bg-card overflow-hidden group">
                  <div className="h-2 bg-primary" />
                  <CardHeader className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-primary">
                        <Crown className="h-6 w-6" />
                      </div>
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                        {customers.filter(c => c.group === group).length} Members
                      </span>
                    </div>
                    <CardTitle className="text-2xl font-serif text-primary group-hover:text-primary/80 transition-colors">
                      {group}
                    </CardTitle>
                    <CardDescription className="text-muted-foreground mt-2">
                      Click to view all VIP quotations and customers in this group.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      ) : (
        <Card className="border-none shadow-2xl bg-card overflow-hidden">
          <CardHeader className="bg-muted border-b border-border p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                {selectedGroup && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setSelectedGroup(null)}
                    className="text-muted-foreground hover:text-primary"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                )}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input 
                    placeholder={selectedGroup ? `Search in ${selectedGroup}...` : "Search by ID, Name or Mobile..."}
                    className="pl-12 h-12 bg-card border-border rounded-xl focus:border-primary focus:ring-primary/10"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              {selectedGroup && (
                <div className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl border border-primary">
                  <Crown className="h-4 w-4" />
                  <span className="text-sm font-bold uppercase tracking-widest">{selectedGroup} VIP Group</span>
                </div>
              )}
            </div>
          </CardHeader>
          
          {selectedGroup && groupInvoices.length > 0 && (
            <div className="px-6 pb-6">
              <div className="bg-primary rounded-2xl p-6 text-primary-foreground shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary-foreground" />
                    <h3 className="text-lg font-sans font-bold">Group Quotations</h3>
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest opacity-50">{groupInvoices.length} Total</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupInvoices.map((inv: any) => (
                    <div key={inv.id} className="bg-primary-foreground/5 border border-primary-foreground/10 rounded-xl p-4 hover:bg-primary-foreground/10 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-bold text-primary-foreground">{inv.invoiceNo}</span>
                        <span className="text-[10px] text-primary-foreground/60">{format(inv.date.toDate(), 'MMM d, yyyy')}</span>
                      </div>
                      <p className="text-xs text-primary-foreground/80 mb-3 truncate">{inv.customerName}</p>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold">{inv.totalAmount.toLocaleString()} BDT</span>
                        <Button variant="ghost" size="sm" className="h-8 text-[10px] text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10 font-bold uppercase px-2">
                          View PDF
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border">
                    <TableHead className="py-3 px-6 text-primary font-bold uppercase tracking-widest text-[9px]">Client ID</TableHead>
                    <TableHead className="text-primary font-bold uppercase tracking-widest text-[9px]">Type</TableHead>
                    <TableHead className="text-primary font-bold uppercase tracking-widest text-[9px]">Full Name</TableHead>
                    <TableHead className="text-primary font-bold uppercase tracking-widest text-[9px]">Contact Info</TableHead>
                    <TableHead className="hidden md:table-cell text-primary font-bold uppercase tracking-widest text-[9px]">Location</TableHead>
                    <TableHead className="text-right px-6 text-primary font-bold uppercase tracking-widest text-[9px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-20 text-muted-foreground">
                        <div className="flex flex-col items-center gap-4">
                          <Users className="h-12 w-12 opacity-10" />
                          <p className="font-sans italic text-lg">No clients found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <TableRow key={customer.id} className="group hover:bg-muted/40 transition-colors border-b border-border last:border-0 text-xs">
                        <TableCell className="px-6 py-3">
                          <span className="font-sans text-[10px] font-bold text-primary bg-muted px-1.5 py-0.5 rounded border border-border">
                            {customer.customerId}
                          </span>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded-full text-[7px] font-bold uppercase tracking-tighter w-fit",
                              customer.type === 'VIP' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            )}>
                              {customer.type || 'Regular'}
                            </span>
                            {customer.group && (
                              <span className="text-[7px] text-muted-foreground font-bold uppercase tracking-widest ml-1">
                                {customer.group}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="font-bold text-primary text-sm leading-tight">{customer.name}</div>
                          <div className="text-[9px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Mail className="h-2.5 w-2.5" />
                            {customer.email || 'No email registered'}
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-1.5 text-primary font-medium text-xs font-sans">
                            <Phone className="h-2.5 w-2.5 text-primary/40" />
                            {customer.mobile}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell max-w-[150px] truncate text-[10px] text-muted-foreground py-3">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                            {customer.address || 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell className="text-right px-6 py-3">
                          <div className="flex justify-end gap-1.5">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => onMakeInvoice?.(customer)}
                              className="h-7 w-7 rounded-lg text-primary hover:bg-primary/10 transition-all"
                              title="Make Invoice"
                            >
                              <Receipt className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => {
                                setSelectedCustomer(customer);
                                setIsReminderModalOpen(true);
                              }}
                              className="h-7 w-7 rounded-lg text-secondary hover:bg-secondary/10 transition-all"
                              title="Set Reminder"
                            >
                              <Bell className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => openEditModal(customer)}
                              className="h-7 px-1.5 text-[9px] rounded-lg border-border text-muted-foreground hover:text-primary hover:border-primary transition-all flex items-center gap-1"
                              title="Edit Customer"
                            >
                              <Edit2 className="h-2.5 w-2.5" />
                              Edit
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => {
                                setCustomerToDelete(customer.id);
                                setIsDeleteModalOpen(true);
                              }}
                              className="h-7 w-7 rounded-lg text-muted-foreground/20 hover:text-destructive hover:bg-destructive/10 transition-all"
                              title="Delete Customer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-[400px] border-none shadow-2xl p-0 overflow-hidden">
          <div className="bg-destructive p-8 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-serif">Confirm Deletion</DialogTitle>
              <CardDescription className="text-white/70">
                This action is permanent and will remove the customer from your database forever.
              </CardDescription>
            </DialogHeader>
          </div>
          <div className="p-8 flex flex-col gap-4 bg-white">
            <p className="text-stone-600 text-sm">Are you absolutely sure you want to delete this client record?</p>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 h-12 rounded-xl border-stone-200"
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDeleteCustomer}
                disabled={loading}
                className="flex-1 h-12 rounded-xl bg-destructive font-bold"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[600px] border-none shadow-2xl p-0 overflow-hidden">
          <div className="bg-primary p-8 text-white flex items-center justify-between">
            <DialogHeader>
              <DialogTitle className="text-3xl font-serif text-secondary">Edit Customer Details</DialogTitle>
              <CardDescription className="text-stone-400">Update information for {editingCustomer?.name}</CardDescription>
            </DialogHeader>
            <Button 
              onClick={handleEditCustomer} 
              disabled={loading}
              className="bg-secondary text-primary font-bold hover:bg-secondary/90"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </div>
          <form onSubmit={handleEditCustomer} className="p-8 space-y-6 bg-white max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="editCustomerId" className="text-xs font-bold uppercase tracking-widest text-stone-500">Customer ID</Label>
                <Input 
                  id="editCustomerId" 
                  value={formData.customerId}
                  readOnly
                  className="h-12 border-stone-200 bg-stone-50 font-sans font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editType" className="text-xs font-bold uppercase tracking-widest text-stone-500">Customer Type</Label>
                <div className="flex gap-2">
                  <Button 
                    type="button"
                    variant={formData.type === 'Regular' ? 'default' : 'outline'}
                    onClick={() => setFormData({...formData, type: 'Regular', group: ''})}
                    className={cn("flex-1 h-12 rounded-xl", formData.type === 'Regular' ? "bg-primary text-secondary" : "")}
                  >
                    Regular
                  </Button>
                  <Button 
                    type="button"
                    variant={formData.type === 'VIP' ? 'default' : 'outline'}
                    onClick={() => setFormData({...formData, type: 'VIP'})}
                    className={cn("flex-1 h-12 rounded-xl", formData.type === 'VIP' ? "bg-secondary text-primary border-secondary" : "")}
                  >
                    VIP
                  </Button>
                </div>
              </div>
            </div>

            {formData.type === 'VIP' && (
              <div className="space-y-2">
                <Label htmlFor="editGroup" className="text-xs font-bold uppercase tracking-widest text-stone-500">VIP Group Name</Label>
                <Input 
                  id="editGroup" 
                  placeholder="Enter group name" 
                  value={formData.group}
                  onChange={e => setFormData({...formData, group: e.target.value})}
                  className="h-12 border-stone-200 focus:border-secondary focus:ring-secondary/20"
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="editName" className="text-xs font-bold uppercase tracking-widest text-stone-500">Full Name *</Label>
                {showValidationErrors && !formData.name && (
                  <span className="text-[10px] text-destructive font-mono font-bold animate-pulse">Required field</span>
                )}
              </div>
              <Input 
                id="editName" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                required
                className={cn(
                  "h-12 border-stone-200 focus:border-secondary focus:ring-secondary/20",
                  showValidationErrors && !formData.name && "border-destructive focus:border-secondary focus:ring-destructive/20 border-2 bg-destructive/5"
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="editMobile" className="text-xs font-bold uppercase tracking-widest text-stone-500">Mobile Number *</Label>
                  {showValidationErrors && !formData.mobile && (
                    <span className="text-[10px] text-destructive font-mono font-bold animate-pulse">Required field</span>
                  )}
                </div>
                <Input 
                  id="editMobile" 
                  value={formData.mobile}
                  onChange={e => setFormData({...formData, mobile: e.target.value})}
                  required
                  className={cn(
                    "h-12 border-stone-200 focus:border-secondary focus:ring-secondary/20",
                    showValidationErrors && !formData.mobile && "border-destructive focus:border-secondary focus:ring-destructive/20 border-2 bg-destructive/5"
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editEmail" className="text-xs font-bold uppercase tracking-widest text-stone-500">Email Address</Label>
                <Input 
                  id="editEmail" 
                  type="email" 
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="h-12 border-stone-200 focus:border-secondary focus:ring-secondary/20"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editAddress" className="text-xs font-bold uppercase tracking-widest text-stone-500">Address</Label>
              <Input 
                id="editAddress" 
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
                className="h-12 border-stone-200 focus:border-secondary focus:ring-secondary/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editNotes" className="text-xs font-bold uppercase tracking-widest text-stone-500">Notes</Label>
              <Input 
                id="editNotes" 
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                className="h-12 border-stone-200 focus:border-secondary focus:ring-secondary/20"
              />
            </div>
            <DialogFooter className="pt-4">
              <Button type="submit" disabled={loading} className="w-full h-14 bg-secondary text-primary font-bold text-lg rounded-xl shadow-lg shadow-secondary/20 hover:bg-secondary/90 transition-all">
                {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reminder Modal */}
      <Dialog open={isReminderModalOpen} onOpenChange={setIsReminderModalOpen}>
        <DialogContent className="sm:max-w-[450px] border-none shadow-2xl p-0 overflow-hidden">
          <div className="bg-secondary p-8 text-primary">
            <DialogHeader>
              <DialogTitle className="text-3xl font-serif">Set Reminder</DialogTitle>
              <CardDescription className="text-primary/70">
                Schedule a follow-up for <span className="font-bold text-primary underline">{selectedCustomer?.name}</span>
              </CardDescription>
            </DialogHeader>
          </div>
          <form onSubmit={handleAddReminder} className="p-8 space-y-6 bg-white">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="remDate" className="text-xs font-bold uppercase tracking-widest text-stone-500">Date</Label>
                <Input 
                  id="remDate" 
                  type="date" 
                  value={reminderData.date}
                  onChange={e => setReminderData({...reminderData, date: e.target.value})}
                  required
                  className="h-12 border-stone-200 focus:border-secondary focus:ring-secondary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="remTime" className="text-xs font-bold uppercase tracking-widest text-stone-500">Time</Label>
                <Input 
                  id="remTime" 
                  type="time" 
                  value={reminderData.time}
                  onChange={e => setReminderData({...reminderData, time: e.target.value})}
                  required
                  className="h-12 border-stone-200 focus:border-secondary focus:ring-secondary/20"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="remMsg" className="text-xs font-bold uppercase tracking-widest text-stone-500">Message</Label>
              <Input 
                id="remMsg" 
                placeholder="e.g. Follow up on design/product package" 
                value={reminderData.message}
                onChange={e => setReminderData({...reminderData, message: e.target.value})}
                required
                className="h-12 border-stone-200 focus:border-secondary focus:ring-secondary/20"
              />
            </div>
            <DialogFooter className="pt-4">
              <Button type="submit" disabled={loading} className="w-full h-14 bg-primary text-secondary font-bold text-lg rounded-xl">
                {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Bell className="mr-2 h-5 w-5" />}
                Set Reminder
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

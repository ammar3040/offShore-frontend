import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Search } from 'lucide-react';
import { getSuperadminAdmins, createSuperadminAdmin, type AdminApi } from '../api/superadmin';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import './SuperadminAdminsPage.css';

const SuperadminAdminsPage = () => {
  const [admins, setAdmins] = useState<AdminApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    firstname: '',
    lastname: '',
    email: '',
    password: '',
    phone: '',
  });

  const fetchAdmins = useCallback(() => {
    setLoading(true);
    setError(null);
    getSuperadminAdmins()
      .then((res) => setAdmins(res.admins ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load admins'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const filteredAdmins = admins.filter((a) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const name = `${a.firstname} ${a.lastname}`.toLowerCase();
    const email = (a.email || '').toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  const handleOpenCreate = () => {
    setIsCreateOpen(true);
    setCreateError(null);
    setFormData({ firstname: '', lastname: '', email: '', password: '', phone: '' });
  };

  const handleCloseCreate = () => {
    if (!createLoading) {
      setIsCreateOpen(false);
      setCreateError(null);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstname || !formData.lastname || !formData.email || !formData.password) {
      setCreateError('First name, last name, email, and password are required');
      return;
    }
    setCreateLoading(true);
    setCreateError(null);
    try {
      await createSuperadminAdmin({
        ...formData,
        phone: formData.phone || '',
      });
      handleCloseCreate();
      fetchAdmins();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create admin');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="superadmin-admins-page">
      <header className="superadmin-admins-header">
        <div>
          <h1 className="superadmin-admins-title">Admins</h1>
          <p className="superadmin-admins-subtitle">
            Manage platform admins. {admins.length} admin{admins.length !== 1 ? 's' : ''} total.
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <UserPlus size={18} className="mr-2" />
          Create Admin
        </Button>
      </header>

      {error && (
        <div className="superadmin-admins-error" role="alert">
          {error}
        </div>
      )}

      <div className="superadmin-admins-toolbar">
        <div className="superadmin-admins-search relative">
          <Search size={18} className="superadmin-admins-search-icon absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search admins..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="superadmin-admins-search-input pl-9"
          />
        </div>
      </div>

      <Card className="superadmin-admins-table-wrap">
        <CardContent className="p-0">
        {loading ? (
          <p className="superadmin-admins-empty">Loading…</p>
        ) : filteredAdmins.length === 0 ? (
          <p className="superadmin-admins-empty">No admins found.</p>
        ) : (
          <table className="superadmin-admins-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Projects</th>
                <th>Crew</th>
              </tr>
            </thead>
            <tbody>
              {filteredAdmins.map((a) => (
                <tr key={a.id}>
                  <td className="superadmin-admins-name">
                    {a.firstname} {a.lastname}
                  </td>
                  <td>{a.email}</td>
                  <td>{a.phone || '—'}</td>
                  <td>{a.projectsCount ?? '—'}</td>
                  <td>{a.crewCount ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={(open) => !open && handleCloseCreate()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Admin</DialogTitle>
          </DialogHeader>
        <form onSubmit={handleCreateAdmin} className="superadmin-create-admin-form space-y-4">
          {createError && (
            <div className="text-destructive text-sm p-3 rounded-md bg-destructive/10 border border-destructive/20" role="alert">
              {createError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sa-firstname">First name</Label>
              <Input
                id="sa-firstname"
                type="text"
                value={formData.firstname}
                onChange={(e) => setFormData((p) => ({ ...p, firstname: e.target.value }))}
                required
                placeholder="John"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sa-lastname">Last name</Label>
              <Input
                id="sa-lastname"
                type="text"
                value={formData.lastname}
                onChange={(e) => setFormData((p) => ({ ...p, lastname: e.target.value }))}
                required
                placeholder="Doe"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sa-email">Email</Label>
            <Input
              id="sa-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
              required
              placeholder="admin@company.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sa-password">Password</Label>
            <Input
              id="sa-password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
              required
              minLength={6}
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sa-phone">Phone (optional)</Label>
            <Input
              id="sa-phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
              placeholder="+1 234 567 8900"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={handleCloseCreate} disabled={createLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={createLoading}>
              {createLoading ? 'Creating…' : 'Create Admin'}
            </Button>
          </div>
        </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperadminAdminsPage;

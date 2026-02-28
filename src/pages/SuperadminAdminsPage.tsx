import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Search } from 'lucide-react';
import { getSuperadminAdmins, createSuperadminAdmin, type AdminApi } from '../api/superadmin';
import Modal from '../components/Modal';
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
        <button type="button" className="superadmin-admins-create-btn" onClick={handleOpenCreate}>
          <UserPlus size={18} />
          Create Admin
        </button>
      </header>

      {error && (
        <div className="superadmin-admins-error" role="alert">
          {error}
        </div>
      )}

      <div className="superadmin-admins-toolbar">
        <div className="superadmin-admins-search">
          <Search size={18} className="superadmin-admins-search-icon" />
          <input
            type="text"
            placeholder="Search admins..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="superadmin-admins-search-input"
          />
        </div>
      </div>

      <div className="superadmin-admins-table-wrap">
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
      </div>

      <Modal isOpen={isCreateOpen} onClose={handleCloseCreate} title="Create Admin" size="medium">
        <form onSubmit={handleCreateAdmin} className="superadmin-create-admin-form">
          {createError && (
            <div className="superadmin-create-admin-error" role="alert">
              {createError}
            </div>
          )}
          <div className="superadmin-create-admin-row">
            <div className="superadmin-create-admin-field">
              <label htmlFor="sa-firstname">First name</label>
              <input
                id="sa-firstname"
                type="text"
                value={formData.firstname}
                onChange={(e) => setFormData((p) => ({ ...p, firstname: e.target.value }))}
                required
                placeholder="John"
              />
            </div>
            <div className="superadmin-create-admin-field">
              <label htmlFor="sa-lastname">Last name</label>
              <input
                id="sa-lastname"
                type="text"
                value={formData.lastname}
                onChange={(e) => setFormData((p) => ({ ...p, lastname: e.target.value }))}
                required
                placeholder="Doe"
              />
            </div>
          </div>
          <div className="superadmin-create-admin-field">
            <label htmlFor="sa-email">Email</label>
            <input
              id="sa-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
              required
              placeholder="admin@company.com"
            />
          </div>
          <div className="superadmin-create-admin-field">
            <label htmlFor="sa-password">Password</label>
            <input
              id="sa-password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
              required
              minLength={6}
              placeholder="••••••••"
            />
          </div>
          <div className="superadmin-create-admin-field">
            <label htmlFor="sa-phone">Phone (optional)</label>
            <input
              id="sa-phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
              placeholder="+1 234 567 8900"
            />
          </div>
          <div className="superadmin-create-admin-actions">
            <button type="button" className="superadmin-create-admin-cancel" onClick={handleCloseCreate} disabled={createLoading}>
              Cancel
            </button>
            <button type="submit" className="superadmin-create-admin-submit" disabled={createLoading}>
              {createLoading ? 'Creating…' : 'Create Admin'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SuperadminAdminsPage;

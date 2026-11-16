import { assignableRoles, type AssignableRole } from '@lumio/shared';
import { CircleCheck, Mail, UserX } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useCancelInvitation,
  useChangeRole,
  useInvitations,
  useInvite,
  useMembers,
  useSetMemberActive,
} from '../../api/admin.js';
import { useMe } from '../../api/auth.js';
import { ErrorAlert } from '../ErrorAlert.js';

function shortDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value));
}

function InviteForm() {
  const { t } = useTranslation();
  const invite = useInvite();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AssignableRole>('learner');
  const [sentTo, setSentTo] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    invite.mutate(
      { email, role },
      {
        onSuccess: () => {
          setSentTo(email);
          setEmail('');
        },
      },
    );
  }

  return (
    <form className="invite-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="invite-email">{t('members.email')}</label>
        <input
          id="invite-email"
          className="input"
          type="email"
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setSentTo(null);
          }}
        />
      </div>
      <div className="field">
        <label htmlFor="invite-role">{t('members.role')}</label>
        <select
          id="invite-role"
          className="input"
          value={role}
          onChange={(event) => setRole(event.target.value as AssignableRole)}
        >
          {assignableRoles.map((option) => (
            <option key={option} value={option}>
              {t(`account.roles.${option}`)}
            </option>
          ))}
        </select>
      </div>
      <button className="btn btn-accent" type="submit" disabled={invite.isPending}>
        <Mail size={16} aria-hidden="true" />
        {invite.isPending ? t('common.loading') : t('members.send')}
      </button>
      {invite.error && <ErrorAlert error={invite.error} />}
      {sentTo && (
        <div className="alert alert-success invite-sent" role="status">
          <CircleCheck size={18} className="ic" aria-hidden="true" />
          <div>{t('members.sent', { email: sentTo })}</div>
        </div>
      )}
    </form>
  );
}

function PendingInvitations() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'tr';
  const invitations = useInvitations();
  const cancel = useCancelInvitation();

  return (
    <section>
      <h4 className="sub-title">{t('members.pending')}</h4>
      {cancel.error && <ErrorAlert error={cancel.error} />}
      {invitations.data?.length === 0 && <p className="empty">{t('members.noPending')}</p>}
      {invitations.data && invitations.data.length > 0 && (
        <ul className="invitation-list">
          {invitations.data.map((invitation) => (
            <li key={invitation.id}>
              <span>
                <strong>{invitation.email}</strong>
                <span className="hint">
                  {t(`account.roles.${invitation.role}`)} ·{' '}
                  {invitation.expired
                    ? t('members.expired')
                    : t('members.expires', { date: shortDate(invitation.expiresAt, locale) })}
                </span>
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate(invitation.id)}
              >
                {t('members.cancelInvite')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function MembersPanel() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'tr';
  const me = useMe().data;
  const members = useMembers();
  const changeRole = useChangeRole();
  const setActive = useSetMemberActive();

  return (
    <div className="stack">
      <article className="card">
        <h3>{t('members.invite')}</h3>
        <p className="hint">{t('members.inviteLead')}</p>
        <InviteForm />
        <PendingInvitations />
      </article>

      <article className="card">
        <h3>{t('admin.members')}</h3>
        {members.isPending && <div className="skeleton" style={{ height: 96 }} />}
        {members.isError && <ErrorAlert error={members.error} />}
        {changeRole.error && <ErrorAlert error={changeRole.error} />}
        {setActive.error && <ErrorAlert error={setActive.error} />}
        {members.data && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('admin.name')}</th>
                  <th>{t('admin.email')}</th>
                  <th>{t('admin.role')}</th>
                  <th>{t('admin.twoFactor')}</th>
                  <th>{t('members.status')}</th>
                  <th>{t('admin.joined')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {members.data.map((member) => {
                  const self = member.id === me?.id;
                  const locked = self || member.role === 'platform_admin';
                  return (
                    <tr key={member.id} className={member.disabled ? 'row-muted' : undefined}>
                      <td>
                        {member.displayName}
                        {self && <span className="badge badge-new">{t('members.you')}</span>}
                      </td>
                      <td>{member.email}</td>
                      <td>
                        {locked ? (
                          t(`account.roles.${member.role}`)
                        ) : (
                          <select
                            className="input input-compact"
                            aria-label={t('members.changeRole', { name: member.displayName })}
                            value={member.role}
                            disabled={changeRole.isPending}
                            onChange={(event) =>
                              changeRole.mutate({
                                id: member.id,
                                role: event.target.value as AssignableRole,
                              })
                            }
                          >
                            {assignableRoles.map((option) => (
                              <option key={option} value={option}>
                                {t(`account.roles.${option}`)}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>{member.twoFactorEnabled ? t('admin.yes') : t('admin.no')}</td>
                      <td>
                        <span className={`badge ${member.disabled ? 'badge-soft' : 'badge-free'}`}>
                          {member.disabled ? t('members.disabled') : t('members.active')}
                        </span>
                      </td>
                      <td className="mono">{shortDate(member.createdAt, locale)}</td>
                      <td>
                        {!locked && (
                          <button
                            type="button"
                            className={`btn btn-sm ${member.disabled ? 'btn-secondary' : 'btn-ghost'}`}
                            disabled={setActive.isPending}
                            onClick={() =>
                              setActive.mutate({ id: member.id, active: member.disabled })
                            }
                          >
                            {!member.disabled && <UserX size={15} aria-hidden="true" />}
                            {member.disabled ? t('members.reactivate') : t('members.deactivate')}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </div>
  );
}

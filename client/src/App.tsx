import { lazy, Suspense, type ReactNode } from 'react';
import { Route, Routes } from 'react-router';
import type { Role } from '@dive/shared';
import { PublicLayout, ScrollManager } from './components/layout/PublicLayout';
import { ProtectedRoute } from './routes/ProtectedRoute';
import Landing from './pages/public/Landing';
import { NotFound } from './pages/public/Placeholder';

const named = <T extends Record<string, unknown>>(p: Promise<T>, k: keyof T) => p.then((m) => ({ default: m[k] as React.ComponentType }));

// public
const About = lazy(() => import('./pages/public/About'));
const Contact = lazy(() => import('./pages/public/Contact'));
const FindGyms = lazy(() => import('./pages/public/FindGyms'));
const GymProfile = lazy(() => import('./pages/public/GymProfile'));
const CoachesPage = lazy(() => import('./pages/public/Coaches'));
const CoachProfilePage = lazy(() => named(import('./pages/public/Coaches'), 'CoachProfilePage'));
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const AdminLogin = lazy(() => import('./pages/auth/AdminLogin'));
const ChangePassword = lazy(() => import('./pages/auth/ChangePassword'));

// member
const MemberLayout = lazy(() => import('./portals/member/MemberLayout'));
const MemberHome = lazy(() => import('./portals/member/MemberHome'));
const CardsList = lazy(() => named(import('./portals/member/CardPages'), 'CardsList'));
const CardPage = lazy(() => named(import('./portals/member/CardPages'), 'CardPage'));
const Payments = lazy(() => named(import('./portals/member/Payments'), 'Payments'));
const Notifications = lazy(() => named(import('./portals/member/Payments'), 'Notifications'));
const Coaching = lazy(() => import('./portals/member/Coaching'));
const MemberMessages = lazy(() => named(import('./portals/member/Coaching'), 'MemberMessages'));
const CheckoutReturn = lazy(() => import('./portals/member/CheckoutReturn'));
const MockPay = lazy(() => import('./portals/member/MockPay'));

// gym
const GymLayout = lazy(() => import('./portals/gym/GymLayout'));
const GymOverview = lazy(() => import('./portals/gym/Overview'));
const Reception = lazy(() => import('./portals/gym/Reception'));
const GymMembers = lazy(() => import('./portals/gym/Members'));
const GymPackages = lazy(() => import('./portals/gym/Packages'));
const GymProfileEdit = lazy(() => import('./portals/gym/Profile'));
const GymPhotos = lazy(() => import('./portals/gym/Photos'));
const GymTrainers = lazy(() => named(import('./portals/gym/Team'), 'Trainers'));
const GymStaff = lazy(() => named(import('./portals/gym/Team'), 'Staff'));
const GymReports = lazy(() => import('./portals/gym/Reports'));
const GymSubscription = lazy(() => import('./portals/gym/Subscription'));

// trainer
const TrainerLayout = lazy(() => import('./portals/trainer/TrainerLayout'));
const TrainerHome = lazy(() => named(import('./portals/trainer/TrainerPages'), 'TrainerHome'));
const TrainerSessions = lazy(() => named(import('./portals/trainer/TrainerPages'), 'TrainerSessions'));
const TrainerAvailability = lazy(() => named(import('./portals/trainer/TrainerPages'), 'TrainerAvailability'));
const TrainerProfile = lazy(() => named(import('./portals/trainer/TrainerPages'), 'TrainerProfile'));
const TrainerMessages = lazy(() => named(import('./portals/trainer/TrainerPages'), 'TrainerMessages'));

// admin
const AdminLayout = lazy(() => import('./portals/admin/AdminPages'));
const AdminHome = lazy(() => named(import('./portals/admin/AdminPages'), 'AdminHome'));
const AdminGyms = lazy(() => named(import('./portals/admin/AdminPages'), 'AdminGyms'));
const AdminTrainers = lazy(() => named(import('./portals/admin/AdminPages'), 'AdminTrainers'));
const AdminUsers = lazy(() => named(import('./portals/admin/AdminPages'), 'AdminUsers'));
const AdminPayments = lazy(() => named(import('./portals/admin/AdminPages'), 'AdminPayments'));
const AdminSettings = lazy(() => named(import('./portals/admin/AdminPages'), 'AdminSettings'));
const AdminInbox = lazy(() => named(import('./portals/admin/AdminPages'), 'AdminInbox'));
const AdminAudit = lazy(() => named(import('./portals/admin/AdminPages'), 'AdminAudit'));

// detail pages
const AdminGymPage = lazy(() => named(import('./portals/admin/AdminDetails'), 'AdminGymPage'));
const AdminTrainerPage = lazy(() => named(import('./portals/admin/AdminDetails'), 'AdminTrainerPage'));
const AdminUserPage = lazy(() => named(import('./portals/admin/AdminDetails'), 'AdminUserPage'));
const AdminPaymentPage = lazy(() => named(import('./portals/admin/AdminDetails'), 'AdminPaymentPage'));
const GymTrainerPage = lazy(() => named(import('./portals/PortalDetails'), 'GymTrainerPage'));
const GymStaffPage = lazy(() => named(import('./portals/PortalDetails'), 'GymStaffPage'));
const ReceiptPage = lazy(() => named(import('./portals/PortalDetails'), 'ReceiptPage'));
const SessionPage = lazy(() => import('./portals/PortalDetails').then((m) => ({ default: m.SessionPage })));

const Fallback = () => <div className="min-h-[60vh] bg-ink" />;
const only = (roles: Role[], el: ReactNode) => <ProtectedRoute roles={roles}>{el}</ProtectedRoute>;

export default function App() {
  return (
    <>
      <ScrollManager />
      <Suspense fallback={<Fallback />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<Landing />} />
            <Route path="about" element={<About />} />
            <Route path="contact" element={<Contact />} />
            <Route path="gyms" element={<FindGyms />} />
            <Route path="gyms/:slug" element={<GymProfile />} />
            <Route path="coaches" element={<CoachesPage />} />
            <Route path="coaches/:id" element={<CoachProfilePage />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="admin/login" element={<AdminLogin />} />
          <Route path="account/password" element={<ChangePassword />} />

          <Route path="app" element={only(['MEMBER'], <MemberLayout />)}>
            <Route index element={<MemberHome />} />
            <Route path="cards" element={<CardsList />} />
            <Route path="cards/:id" element={<CardPage />} />
            <Route path="coaching" element={<Coaching />} />
            <Route path="coaching/:id" element={<SessionPage as="member" />} />
            <Route path="payments/:id" element={<ReceiptPage />} />
            <Route path="messages" element={<MemberMessages />} />
            <Route path="payments" element={<Payments />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="checkout/return" element={<CheckoutReturn />} />
          </Route>
          <Route path="pay/mock/:id" element={only(['MEMBER', 'GYM_OWNER'], <MockPay />)} />

          <Route path="gym" element={only(['GYM_OWNER', 'RECEPTIONIST'], <GymLayout />)}>
            <Route index element={<GymOverview />} />
            <Route path="reception" element={<Reception />} />
            <Route path="members" element={<GymMembers />} />
            <Route path="packages" element={<GymPackages />} />
            <Route path="profile" element={<GymProfileEdit />} />
            <Route path="photos" element={<GymPhotos />} />
            <Route path="trainers" element={<GymTrainers />} />
            <Route path="trainers/:id" element={<GymTrainerPage />} />
            <Route path="staff" element={<GymStaff />} />
            <Route path="staff/:id" element={<GymStaffPage />} />
            <Route path="reports" element={<GymReports />} />
            <Route path="subscription" element={<GymSubscription />} />
          </Route>

          <Route path="trainer" element={only(['TRAINER'], <TrainerLayout />)}>
            <Route index element={<TrainerHome />} />
            <Route path="sessions" element={<TrainerSessions />} />
            <Route path="sessions/:id" element={<SessionPage as="trainer" />} />
            <Route path="availability" element={<TrainerAvailability />} />
            <Route path="profile" element={<TrainerProfile />} />
            <Route path="messages" element={<TrainerMessages />} />
          </Route>

          <Route path="admin" element={only(['ADMIN'], <AdminLayout />)}>
            <Route index element={<AdminHome />} />
            <Route path="gyms" element={<AdminGyms />} />
            <Route path="gyms/:id" element={<AdminGymPage />} />
            <Route path="trainers" element={<AdminTrainers />} />
            <Route path="trainers/:id" element={<AdminTrainerPage />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="users/:id" element={<AdminUserPage />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="payments/:id" element={<AdminPaymentPage />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="inbox" element={<AdminInbox />} />
            <Route path="audit" element={<AdminAudit />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}

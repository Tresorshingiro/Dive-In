import { useState } from 'react';
import { usePublicData, locate } from '../../hooks/usePublicData';
import { Hero } from '../../components/landing/Hero';
import { NeighbourhoodMarquee } from '../../components/landing/NeighbourhoodMarquee';
import { HowItWorks } from '../../components/landing/HowItWorks';
import { GymsNearYou } from '../../components/landing/GymsNearYou';
import { Coaches } from '../../components/landing/Coaches';
import { CardSection } from '../../components/landing/CardSection';
import { RoleCards } from '../../components/landing/RoleCards';
import { PartnerPricing } from '../../components/landing/PartnerPricing';
import { FinalCta } from '../../components/landing/FinalCta';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

export default function Landing() {
  useDocumentTitle('DIVE-IN Fitness Hub — Gyms, coaches & memberships in Kigali', { raw: true });
  const data = usePublicData();
  const [area, setArea] = useState('All');
  const [gymQuery, setGymQuery] = useState('');
  const [coachQuery, setCoachQuery] = useState('');
  const [user, setUser] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const doLocate = async () => {
    setLocating(true);
    setLocateError(null);
    try {
      setUser(await locate());
      setArea('All');
      return true;
    } catch (e) {
      setLocateError((e as Error).message);
      return false;
    } finally {
      setLocating(false);
    }
  };

  return (
    <>
      <Hero
        locating={locating}
        locateError={locateError}
        onSearch={(tab, q) => {
          if (tab === 'gyms') {
            setGymQuery(q);
            setArea('All');
            scrollTo('gyms');
          } else {
            setCoachQuery(q);
            scrollTo('coaches');
          }
        }}
        onNearMe={async (q) => {
          setGymQuery(q);
          await doLocate();
          scrollTo('gyms');
        }}
      />
      <NeighbourhoodMarquee />
      <HowItWorks />
      <GymsNearYou
        gyms={data.gyms}
        live={data.live}
        area={area}
        setArea={setArea}
        query={gymQuery}
        clearQuery={() => setGymQuery('')}
        user={user}
        onLocate={doLocate}
        locating={locating}
      />
      <Coaches trainers={data.trainers} config={data.config} query={coachQuery} clearQuery={() => setCoachQuery('')} />
      <CardSection />
      <RoleCards />
      <PartnerPricing config={data.config} />
      <FinalCta />
    </>
  );
}

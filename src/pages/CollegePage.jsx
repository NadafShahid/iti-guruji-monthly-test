import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db, getFromAnyDb } from '../firebase';
import { get, ref } from 'firebase/database';
import { Award, Facebook, GraduationCap, Image as ImageIcon, Instagram, Linkedin, MapPin, Star, Users } from 'lucide-react';
import './CollegePage.css';

export default function CollegePage() {
  const { slug } = useParams();
  const [stage, setStage] = useState('loading');
  const [college, setCollege] = useState(null);

  useEffect(() => {
    const loadCollege = async () => {
      try {
        const storageSlug = String(slug || '').trim().replace(/\s+/g, '%20').toLowerCase();
        const snapshot = await getFromAnyDb(`gurujismart/CollegeWebsites/${storageSlug}`);
        if (!snapshot.exists()) {
          setStage('missing');
          return;
        }
        setCollege(snapshot.val());
        setStage('ready');
      } catch (error) {
        console.error('Failed to load college website', error);
        setStage('error');
      }
    };
    loadCollege();
  }, [slug]);

  if (stage === 'loading') {
    return <div className="college-state">Loading college website...</div>;
  }

  if (stage === 'missing') {
    return <div className="college-state">College website not found.</div>;
  }

  if (stage === 'error') {
    return <div className="college-state">Unable to load this website right now.</div>;
  }

  const features = toArray(college.features);
  const activities = toArray(college.activities);
  const toppers = toArray(college.toppers);
  const gallery = toArray(college.gallery);
  const team = toArray(college.team);
  const bloggerInfo = college.bloggerInfo || {};

  return (
    <div className="college-page">
      <section className="college-hero">
        <div>
          <p className="college-kicker"><MapPin size={16} /> {college.city || 'College'}</p>
          <h1>{college.collegeName || 'College Website'}</h1>
          <p className="college-subtitle">Achievements, activities, team, and memories from our institute.</p>
        </div>
      </section>

      {features.length > 0 && (
        <section className="college-section">
          <h2><Star size={22} /> College Features</h2>
          <div className="feature-grid">
            {features.map((feature, index) => <div className="feature-item" key={index}>{feature}</div>)}
          </div>
        </section>
      )}

      {activities.length > 0 && (
        <section className="college-section">
          <h2><GraduationCap size={22} /> Activities</h2>
          <div className="activity-list">
            {activities.map((activity, index) => (
              <article className="activity-item" key={index}>
                <h3>{activity.title || 'Activity'}</h3>
                <p>{activity.description || ''}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {toppers.length > 0 && (
        <section className="college-section">
          <h2><Award size={22} /> Toppers</h2>
          <div className="topper-grid">
            {toppers.map((topper, index) => (
              <article className="topper-card" key={index}>
                {topper.photo ? <img src={topper.photo} alt={topper.name || 'Topper'} /> : <div className="photo-placeholder"><Award size={32} /></div>}
                <h3>{topper.name || 'Topper'}</h3>
                <p>{topper.exam || ''}</p>
                <span>Rank: {topper.rank || '-'}</span>
                <span>Marks: {topper.obtainedMarks || '-'} / {topper.totalMarks || '-'}</span>
              </article>
            ))}
          </div>
        </section>
      )}

      {gallery.length > 0 && (
        <section className="college-section">
          <h2><ImageIcon size={22} /> Gallery</h2>
          <div className="gallery-grid">
            {gallery.map((url, index) => <img src={url} alt={`Gallery ${index + 1}`} key={index} />)}
          </div>
        </section>
      )}

      {team.length > 0 && (
        <section className="college-section">
          <h2><Users size={22} /> Our Team</h2>
          <div className="team-grid">
            {team.map((member, index) => (
              <div className="team-card" key={index}>
                <strong>{member.name || 'Trainer'}</strong>
                <span>{member.mobile || ''}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="college-section social-section">
        <a className={!bloggerInfo.facebook ? 'disabled' : ''} href={bloggerInfo.facebook || undefined} target="_blank" rel="noreferrer"><Facebook size={18} /> Facebook</a>
        <a className={!bloggerInfo.instagram ? 'disabled' : ''} href={bloggerInfo.instagram || undefined} target="_blank" rel="noreferrer"><Instagram size={18} /> Instagram</a>
        <a className={!bloggerInfo.linkedin ? 'disabled' : ''} href={bloggerInfo.linkedin || undefined} target="_blank" rel="noreferrer"><Linkedin size={18} /> LinkedIn</a>
      </section>
    </div>
  );
}

function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === 'object') return Object.values(value).filter(Boolean);
  return [];
}

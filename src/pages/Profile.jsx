import React, { useEffect, useState } from 'react';
import { useUser } from '../UserContext.jsx';
import { ROLE } from '../roles.js';

export default function Profile() {
    const { user } = useUser();

    useEffect(() => {
        const storedImage = localStorage.getItem('profileImage');
        if (storedImage) {
            user.profilePic = storedImage;
        }
    }, []);

    const handleImageChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result;
                user.profilePic = base64String;
                localStorage.setItem('profileImage', base64String);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <section className="profile">
            <section className="container" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-start', width: '100%', paddingTop: '1rem', flexGrow: 1, gap: '1.5rem' }}>
                <div className="card" style={{ padding: '2.5rem 2rem', width: '600px', margin: '0 auto'}}>
                    <h1>My Profile</h1>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <img
                                src={user.profilePic || 'https://via.placeholder.com/150'}
                                alt="Profile"
                                style={{ width: '100px', height: '100px', 
                                    borderRadius: '50%', margin: '0.75rem', 
                                    padding: '0.25rem', border: '1px solid #ccc', 
                                    marginTop: '30px' }}
                            />
                            <div className="profile-info" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', }}>
                                <span style={{ fontSize: '1.1rem', position: 'relative', left: '16px', top: '10px' }}>
                                    <strong>Name:</strong> {user.name}</span>
                            <input
                                id="profileImage"
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                style={{ display: 'none' }}
                            />
                            <br></br>
                            <label htmlFor="profileImage" className="btn" 
                                style={{ padding: '0.35rem 0.9rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                                Change Profile Picture
                            </label>
                        </div>
                    </div>
                </div>

                <div className="card" style={{ padding: '2.5rem 2rem', width: '600px', margin: '0 auto'}}>
                    <h1>My Stats</h1>
                    <p><strong>Role:</strong> {user.role === ROLE.PARENT ? 'Parent' : user.role === ROLE.PROVIDER ? 'Provider' : 'User'}</p>
                    <p><strong>Total Tasks Completed:</strong> {user.stats?.tasksCompleted || 0}</p>
                    <p><strong>Total Habits Built:</strong> {user.stats?.habitsBuilt || 0}</p>
                    <p><strong>Total Habits Broken:</strong> {user.stats?.habitsBroken || 0}</p>
                    <p><strong>Longest Streak:</strong> {user.stats?.longestStreak || "0 days"}</p>
                </div>

                <div className="card" style={{ padding: '2.5rem 2rem', width: '1000px', margin: '0 auto', marginTop: '1.5rem' }}>
                    <h1>My Friends</h1>
                    <p>You currently have no friends added.</p>
                </div>

            </section>
        </section>
    )

  };

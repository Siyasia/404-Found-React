import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';

export default function Signup() {

    const navigate = useNavigate();
    const { setUser } = useUser();

    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState('');
    const [age, setAge] = useState('');
    const [role, setRole] = useState('');
    const [childCode, setChildCode] = useState('');
    const [error, setError] = useState('');

    const handleSignUp = (event) => {
        event.preventDefault();
        setError('');

        const trimmedName = name.trim();
        const numericAge = Number(age);

        // ==== NON-CHILD ROLES (user, parent, provider) ====
        if (!trimmedName || !age || !role || !password || !email) {
        setError('Please fill in all fields.');
        return;
        };

        if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
            setError('Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, and one number.');
            return;
        };

        if ((role === 'user' || role === 'parent') && numericAge < 14) {
        setError(
            'Users and parents must be at least 14 years old. Please adjust the age or choose a different role.'
        );
        return;
        };

    const newUser = {
        id: crypto.randomUUID ? crypto.randomUUID() : `u-${Date.now()}`, // <-- NEW
        password,
        email,
        name: trimmedName,
        age: numericAge,
        role,
        createdAt: new Date().toISOString(),
    };

    setUser(newUser);
    navigate('/home');
};

  return (
    
    <section className="container" style={{ maxWidth: '520px', paddingTop: '3rem' }}>
      <div className="card" style={{ padding: '2.5rem 2rem' }}>
        <h1>Welcome to Next Steps</h1>
        <p className="sub hero" style={{ marginTop: '0.5rem' }}>
            Create your account to get started. Children accounts can be created under a parent once logged in.
        </p>

        <form onSubmit={handleSignUp}>

            {/* gather role choice*/}
            <label className="auth-label">
                Role
                <select 
                    value={role}
                    onChange={(e) => {
                        setRole(e.target.value);
                        setError('');
                    }}
                >
                    <option value="">Select a role…</option>
                    <option value="parent">Parent</option>
                    <option value="provider">Provider</option>
                    <option value="user">User (14+)</option>  
                </select>
            </label>
            {/* gather name */}
            <label className="auth-label">
                Name
                <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="enter name of user"
                />
            </label>
            {/* gather email */}
            <label className="auth-label">
                Email
                <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="enter email address"
                />
            </label>
            {/* gather age */}
            <label className="auth-label">
                Age
                <input 
                    type="number" 
                    min="1"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="enter age of user"
                />
            </label>

            <label className="auth-label">
                Password
                   <div className="password-input-wrapper" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                       <input
                           id="signup-password"
                           type={showPassword ? "text" : "password"}
                           value={password}
                           onChange={(e) => setPassword(e.target.value)}
                           placeholder="Create a password"
                           aria-describedby="signup-password-visibility-toggle"
                       />
                       <button
                           type="button"
                           id="signup-password-visibility-toggle"
                           aria-label={showPassword ? "Hide password" : "Show password"}
                           onClick={() => setShowPassword((v) => !v)}
                           className="icon-button"
                           style={{
                               border: "1px solid #ccc",
                               background: "white",
                               padding: "6px 10px",
                               borderRadius: "6px",
                               cursor: "pointer",
                           }}
                       >
                           {showPassword ? " Hide" : " Show"}
                       </button>
                   </div>
            </label>
            <div className="passwordRequirement" id="passwordRequirement">
                Your password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, and one number.
            </div>

            {error && (
                <p style={{ marginTop: '0.5rem', color: '#b91c1c', fontSize: '0.95rem' }}>
                {error}
                </p>
            )}

            <button
                type="submit"
                className="btn btn-primary"
                style={{ marginTop: '1.5rem', width: '100%' }}
            >
                Sign Up
            </button>
            <br></br>
            <hr></hr>
            <br></br>

            <div className="container signin">
                <p>Already have an account? <a href="/login">Log In</a>.</p>
            </div>

        </form>
    </div>
</section>
  );
}


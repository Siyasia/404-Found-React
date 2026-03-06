import HabitWizard from '../components/HabitWizard/HabitWizard.jsx';

/**
 * Simple page to test the Habit Wizard.
 * Removing this later when integrating into main app.
 */

export default function HabitWizardPage() {
  const handleSubmit = (plan) => {
    console.log('[HabitWizard] Plan created:', plan);
    // For now, just show success message
    alert('Habit created! Check the console for the data.');
  };

  return (
    <section className="container">
      <h1>Create a New Habit</h1>
      <p className="sub">Follow the steps below to create your habit.</p>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <HabitWizard 
          context="self" 
          onSubmit={handleSubmit} 
          embedded={true} 
        />
      </div>
    </section>
  );
}

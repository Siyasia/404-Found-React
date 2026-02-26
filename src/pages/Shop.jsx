import React, { useEffect, useState } from 'react';
import { useGameProfile } from '../components/useGameProfile.js';
import { GameItem, GameProfile } from '../models/index.js';

export default function Shop() {

  const { profile, saveProfile, loading, error } = useGameProfile();
  const [modal, setModal] = React.useState(null); // For showing item details or purchase confirmation
  //used for current front-end item holding
  const [inventory, setInventory] = React.useState([]); // User's purchased items

  if (loading) return <p>Loading...</p>;

  //list of example items
  
  const items = [
    { id: 1, name: 'Potion', price: 50, image: '/images/potion.png' },
    { id: 2, name: 'Sword', price: 150, image: '/images/sword.png' },
    { id: 3, name: 'Shield', price: 120, image: '/images/shield.png' },
    { id: 4, name: 'Helmet', price: 80, image: '/images/helmet.png' },
    { id: 5, name: 'get coins', price: 0, image: '/images/helmet.png' }
  ];
  //TODO: create list of items in the database and display those instead

  const showModal = (message, type = 'info') => {
    setModal(message, type);
  };

  const closeModal = (message) => {
    setModal(null);
  };

  //function to handle buying items
  async function buyItem(item) {

    //holds profile information to be updated after buying item
    const updated = new GameProfile({
      id: profile.id,
      coins: profile.coins,
      inventory: profile.inventory
    });
    console.log("Current profile ID:", profile.id);
    console.log("Saving profile ID:", updated.id);

    //temporary solution to add coins to user's game profile
    if (item.name === 'get coins') {
      updated.coins += 200;
      showModal("You received 200 coins!");
      await saveProfile(updated);
      return;
    }
    if (profile.inventory.find(i => i.id === item.id)) {
      showModal(`You already own a(n) ${item.name}.`);
      return;
    }
    //if they do not own the item and have enough money, buy item
    if (profile.coins < item.price) {
      showModal("Not enough coins.");
      return;
    }

    //used for current front end storage of inventory
    const newInventory = [...inventory, item];
    newInventory.sort((a, b) => a.id - b.id);
    setInventory(newInventory);

    //if passed all above cases, buy item
    updated.coins -= item.price;
    updated.inventory.push({
      id: item.id,
      equipped: false,
    });

    updated.inventory.sort((a, b) => a.id - b.id);
    showModal(`You bought a(n) ${item.name}!`)

    console.log("Saving profile ID:", updated.id);
    //update user's profile with item and coin info
    await saveProfile(updated);
  };

  //TODO: display items from inventory correctly
  return (
    <section className="container" style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', paddingTop: '2rem', flexGrow: 1, gap: '1.5rem', paddingLeft: '0rem', paddingRight: '0rem' }}>

      <div className="card" style={{ width: '1000px', padding: '1.4rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h1>Shop</h1>
        <strong>Here, you can trade your coins for items.</strong>

        <div className="coin-balance" style={{ marginBottom: '1.5rem', fontSize: '1rem' }}>
          <p><strong>Your Coins:</strong>{profile.coins}</p>
        </div>

        <div className="items" style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {items.map(item => (
            <div key={item.id} className="item-card" style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '1rem', width: '150px', textAlign: 'center' }}>
              <img src={item.image} alt={item.name} style={{ width: '100px', height: '100px' }} />
              <h3>{item.name}</h3>
              <p><strong>Price:</strong> {item.price} coins</p>
              <button onClick={() => buyItem(item)} style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>Buy</button>
            </div>
          ))}
        </div>
      </div>

      {modal && (
        <div className="modal" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="modal-content" style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '8px', textAlign: 'center' }}>
            <p>{modal}</p>
            <button onClick={closeModal} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>Close</button>
          </div>
        </div>
      )}
      
      <div className="card" style={{ width: '300px', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h3>Your Inventory</h3>
        {profile.inventory.length === 0 ? (
          <p>You don't have any items yet. Try buying some from the shop!</p>
        ) : (
          <div className="inventory" style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center' }}>
            {inventory.map(item => (
              <div key={item.id} className="inventory-item" style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '1rem', width: '100px', textAlign: 'center' }}>
                <img src={item.image} alt={item.name} style={{ width: '75px', height: '75px' }} />
                <h4>{item.name}</h4>
              </div>
            ))}
          </div>
        )}
      </div>

    </section>
  );
}

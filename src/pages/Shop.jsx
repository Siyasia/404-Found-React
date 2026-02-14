import React, { useEffect, useState } from 'react';
import { useUser } from '../UserContext.jsx';
import { ROLE } from '../Roles/roles.js';
import { userUpdate } from '../lib/api/user.js';

export default function Shop() {

  const { user, setUser } = useUser();

  const [coins, setCoins] = React.useState(200); // Example coin balance
  const [inventory, setInventory] = React.useState([]); // User's purchased items
  const [modal, setModal] = React.useState(null); // For showing item details or purchase confirmation

  //list of example items
  const items = [
    { id: 1, name: 'Potion', price: 50, image: '/images/potion.png' },
    { id: 2, name: 'Sword', price: 150, image: '/images/sword.png' },
    { id: 3, name: 'Shield', price: 120, image: '/images/shield.png' },
    { id: 4, name: 'Helmet', price: 80, image: '/images/helmet.png' }
  ];

  const showModal = (message, type = 'info') => {
    setModal(message, type);
  };

  const closeModal = (message) => {
    setModal(null);
  };

  //function to handle buying an item
  const buyItem = (item) => {
    if (inventory.find(i => i.id === item.id)) {
      showModal(`You already own a(n) ${item.name}.`);
      return;
    }
    if (coins >= item.price) {
      setCoins(coins - item.price);
      //keep inventory sorted by id for easier management
      const newInventory = [...inventory, item];
      newInventory.sort((a, b) => a.id - b.id);
      setInventory(newInventory);
      showModal(`You bought a(n) ${item.name}!`);
    } else {
      showModal('Not enough coins.');
    }
  };

  return (
    <section className="container" style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', paddingTop: '2rem', flexGrow: 1, gap: '1.5rem', paddingLeft: '0rem', paddingRight: '0rem' }}>

      <div className="card" style={{ width: '1000px', padding: '1.4rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h1>Shop</h1>
        <strong>Here, you can trade your coins for items.</strong>

        <div className="coin-balance" style={{ marginBottom: '1.5rem', fontSize: '1rem' }}>
          <p><strong>Your Coins:</strong> {coins}</p>
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
        {inventory.length === 0 ? (
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
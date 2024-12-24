import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../config/firebase';

export const addTrade = async (userId, tradeData) => {
  try {
    const tradesRef = collection(db, 'trades');
    const trade = {
      ...tradeData,
      userId,
      createdAt: new Date().toISOString(),
    };
    const docRef = await addDoc(tradesRef, trade);
    return { ...trade, id: docRef.id };
  } catch (error) {
    console.error('Error adding trade:', error);
    throw error;
  }
};

export const getUserTrades = async (userId) => {
  try {
    const tradesRef = collection(db, 'trades');
    const q = query(
      tradesRef, 
      where('userId', '==', userId),
      orderBy('date', 'desc'),
      orderBy('time', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting trades:', error);
    throw error;
  }
};

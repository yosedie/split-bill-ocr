import React, { useState, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import { Camera, Upload, Loader2, Split, Users, AlertCircle, Plus, Trash2 } from 'lucide-react';

interface Person {
  id: string;
  name: string;
}

interface BillItem {
  description: string;
  amount: number;
  includedInSplit: boolean;
  assignedTo: string[];
}

function App() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [items, setItems] = useState<BillItem[]>([]);
  const [people, setPeople] = useState<Person[]>([
    { id: '1', name: 'Person 1' },
    { id: '2', name: 'Person 2' }
  ]);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addPerson = () => {
    const newId = (people.length + 1).toString();
    setPeople([...people, { id: newId, name: `Person ${newId}` }]);
  };

  const removePerson = (id: string) => {
    if (people.length > 2) {
      setPeople(people.filter(p => p.id !== id));
      setItems(items.map(item => ({
        ...item,
        assignedTo: item.assignedTo.filter(personId => personId !== id)
      })));
    }
  };

  const updatePersonName = (id: string, newName: string) => {
    setPeople(people.map(p => p.id === id ? { ...p, name: newName } : p));
  };

  const processImage = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      const worker = await createWorker('eng');
      console.log('Starting OCR processing...');
      const { data: { text } } = await worker.recognize(file);
      console.log('OCR Result:', text);
      
      const lines = text.split('\n');
      const prices: string[] = [];
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        const priceMatch = trimmedLine.match(/(?:[$]?\s*(\d+(?:\.\d{2})?))$/);
        
        if (priceMatch) {
          const priceStr = priceMatch[1];
          const price = parseFloat(priceStr);
          
          if (!isNaN(price) && price > 0) {
            if (price >= 0.50 && price <= 1000) {
              prices.push(priceStr);
              console.log('Found price:', price, 'from line:', trimmedLine);
            }
          }
        }
      }
      
      if (prices.length > 0) {
        const newItems = prices.map((price, index) => ({
          description: `Item ${index + 1}`,
          amount: parseFloat(price),
          includedInSplit: true,
          assignedTo: people.map(p => p.id)
        }));
        setItems(newItems);
        console.log('Extracted prices:', newItems);
      } else {
        setError('No prices found in the receipt. Please ensure the image is clear and contains dollar amounts.');
      }
      
      await worker.terminate();
    } catch (error) {
      console.error('Error processing image:', error);
      setError('An error occurred while processing the image. Please try again.');
    }
    setIsProcessing(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        processImage(file);
      } else {
        setError('Selected file is not an image. Please choose an image file.');
      }
    }
  };

  const handleCameraCapture = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const calculateTotal = () => {
    return items
      .filter(item => item.includedInSplit)
      .reduce((sum, item) => sum + item.amount, 0);
  };

  const calculatePerPerson = (personId: string) => {
    return items
      .filter(item => item.includedInSplit && item.assignedTo.includes(personId))
      .reduce((sum, item) => sum + (item.amount / item.assignedTo.length), 0);
  };

  const formatDollars = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const toggleItemAssignment = (itemIndex: number, personId: string) => {
    const newItems = [...items];
    const item = newItems[itemIndex];
    if (item.assignedTo.includes(personId)) {
      if (item.assignedTo.length > 1) {
        item.assignedTo = item.assignedTo.filter(id => id !== personId);
      }
    } else {
      item.assignedTo = [...item.assignedTo, personId];
    }
    setItems(newItems);
  };

  const clearAll = () => {
    setItems([]);
    setImagePreview(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Split className="h-6 w-6" />
              Bill Splitter
            </h1>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                <Users className="h-5 w-5" />
                People
              </h2>
              <button
                onClick={addPerson}
                className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Person
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {people.map(person => (
                <div key={person.id} className="flex items-center gap-2 bg-gray-50 p-3 rounded-md">
                  <input
                    type="text"
                    value={person.name}
                    onChange={(e) => updatePersonName(person.id, e.target.value)}
                    className="flex-1 bg-transparent border-none focus:ring-0 p-0"
                  />
                  {people.length > 2 && (
                    <button
                      onClick={() => removePerson(person.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4 mb-6">
            <button
              onClick={handleCameraCapture}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              <Camera className="h-5 w-5" />
              Take Photo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label className="flex-1 flex items-center justify-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors cursor-pointer">
              <Upload className="h-5 w-5" />
              Upload Image
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {imagePreview && (
            <div className="mb-6">
              <img
                src={imagePreview}
                alt="Receipt preview"
                className="w-full h-auto rounded-lg shadow-md"
              />
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 rounded-md flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-2">Processing receipt...</span>
            </div>
          )}

          {items.length > 0 && (
            <div className="space-y-4">
              <div className="border rounded-md overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Include</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Item</th>
                      <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">Amount</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Split Between</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {items.map((item, index) => (
                      <tr key={index} className={!item.includedInSplit ? 'bg-gray-50' : ''}>
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={item.includedInSplit}
                            onChange={(e) => {
                              const newItems = [...items];
                              newItems[index].includedInSplit = e.target.checked;
                              setItems(newItems);
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => {
                              const newItems = [...items];
                              newItems[index].description = e.target.value;
                              setItems(newItems);
                            }}
                            className="w-full border-none focus:ring-0 bg-transparent"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">{formatDollars(item.amount)}</td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-2">
                            {people.map(person => (
                              <button
                                key={person.id}
                                onClick={() => toggleItemAssignment(index, person.id)}
                                className={`px-2 py-1 text-xs rounded-full ${
                                  item.assignedTo.includes(person.id)
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {person.name}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span>Total Bill:</span>
                  <span>{formatDollars(calculateTotal())}</span>
                </div>
                {people.map(person => (
                  <div key={person.id} className="flex justify-between text-sm">
                    <span>{person.name}'s Share:</span>
                    <span>{formatDollars(calculatePerPerson(person.id))}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={clearAll}
                className="w-full mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                Start New
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
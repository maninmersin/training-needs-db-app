import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { saveAs } from 'file-saver';

const App = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data, error } = await supabase.rpc('get_project_roles_data');

        if (error) {
          throw error;
        }

        setData(data);
      } catch (error) {
        setError(error.message);
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const convertToCSV = (objArray) => {
    const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray;
    let str = `${Object.keys(array[0])
      .map((value) => `"${value}"`)
      .join(',')}\r\n`;

    return (
      str +
      array
        .map((obj) => {
          return Object.values(obj)
            .map((value) => `"${value}"`)
            .join(',');
        })
        .join('\r\n')
    );
  };

  const exportCSV = () => {
    const csv = convertToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'data.csv');
  };

  return (
    <div>
      <h1>Data from Supabase</h1>
      <button onClick={exportCSV}>Export to CSV</button>
      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p>Error: {error}</p>
      ) : (
        <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
          <table>
            <thead>
              <tr>
                {data.length > 0 && Object.keys(data[0]).map((key) => (
                  <th key={key}>{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => (
                <tr key={index}>
                  {Object.keys(item).map((key) => (
                    <td key={key}>{item[key]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default App;

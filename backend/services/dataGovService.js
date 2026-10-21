// Downloads NEA's hawker centre data from data.gov.sg. Only the backend calls data.gov.sg.
// Dataset: "Dates of Hawker Centres Closure" (NEA), which lists every hawker centre with its address,
// location, photo, number of food stalls and its cleaning / repair closures.
// https://data.gov.sg/datasets/d_bda4baa634dd1cc7a6c7cad5f19e2d68/view
import axios from 'axios';

export const HAWKER_DATASET_ID = 'd_bda4baa634dd1cc7a6c7cad5f19e2d68';
const DATASTORE_URL = 'https://data.gov.sg/api/action/datastore_search';
const PAGE_SIZE = 100;

// Returns every record in the dataset (about 120). The API sends at most PAGE_SIZE at a time,
// so this keeps asking for the next page until it has them all.
export async function fetchHawkerCentreRecords() {
    const records = [];
    let total = Infinity;

    while (records.length < total) {
        let response;
        try {
            response = await axios.get(DATASTORE_URL, {
                params: { resource_id: HAWKER_DATASET_ID, limit: PAGE_SIZE, offset: records.length },
                timeout: 20000
            });
        } catch (error) {
            throw new Error(`data.gov.sg request failed (${error.response?.status || error.message})`);
        }

        const result = response.data?.result;
        if (!response.data?.success || !Array.isArray(result?.records)) {
            throw new Error('data.gov.sg sent an unexpected response');
        }

        total = result.total;
        records.push(...result.records);

        if (result.records.length === 0) {
            break; // nothing more to fetch, even if total said otherwise
        }
    }

    return records;
}

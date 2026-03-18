import { recraftGet } from '../client.js';
import { ENDPOINTS } from '../constants.js';

interface UserInfo {
  id: string;
  email: string;
  name: string;
  credits: number;
}

export async function checkCredits(): Promise<string> {
  const user = await recraftGet<UserInfo>(ENDPOINTS.USERS_ME);
  return [
    `**Recraft Account Info**`,
    `- **Name:** ${user.name || 'N/A'}`,
    `- **Email:** ${user.email || 'N/A'}`,
    `- **Credits:** ${user.credits}`,
    `- **ID:** ${user.id}`,
  ].join('\n');
}
